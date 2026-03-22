
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Utilidades
function truncate(str, maxChars) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '\n…[truncated]';
}

async function getText(env, key, cache) {
  if (cache && cache[key] !== undefined) return cache[key];
  try {
    if (!env.BUILDAPPS) return '';
    const obj = await env.BUILDAPPS.get(key);
    const text = obj ? await obj.text() : '';
    if (cache) cache[key] = text;
    return text;
  } catch { return ''; }
}

export async function onRequestPost(context) {
  // cache leve por request
  const cache = {};
  try {
    const env = context.env;
    const body = await context.request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sessionId = body.session_id || null;
    const userType = body.user_type || null;

    if (!messages.length) return json({ error: "messages e obrigatorio" }, 400);

    // Segurança: nunca expor secrets ao cliente
    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) return json({ error: "OPENAI_API_KEY nao configurada nas variaveis de ambiente" }, 500);

    // Busca configs do banco e do R2
    const [configRow, promptRow, flowRow, moderationRow, summaryInitialRow, summaryUpdateRow, r2Config] = await Promise.all([
      env.DB.prepare("SELECT value FROM configs WHERE key = 'openai_config' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'prompt' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'flow' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'moderation_message' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'summary_initial' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'summary_update' LIMIT 1").first(),
      getText(env, "config.json", cache)
    ]);

    let config = configRow ? JSON.parse(configRow.value) : { model: "gpt-4.1-mini" };
    if (r2Config) {
      try {
        const r2Parsed = JSON.parse(r2Config);
        config = { ...config, ...r2Parsed };
      } catch {}
    }
    const prompt             = promptRow?.value || "";
    const flow               = flowRow?.value || "";
    const moderationMessage  = moderationRow?.value || "";
    const summaryInitial     = summaryInitialRow?.value || "";
    const summaryUpdate      = summaryUpdateRow?.value || "";

    // Carrega knowledge e template do R2
    const [knowledge, formTemplate] = await Promise.all([
      getText(env, "knowledge/anamnese_base.txt", cache),
      getText(env, "templates/form.txt", cache)
    ]);

    // Monta o system prompt
    const systemParts = [];
    if (prompt) systemParts.push(prompt);
    if (flow) systemParts.push(`Fluxo:\n${flow}`);
    if (moderationMessage) systemParts.push(
      `Moderacao: Se o paciente enviar conteudo fora do escopo clinico ou linguagem inadequada, responda EXATAMENTE com este texto: "${moderationMessage}"`
    );
    if (formTemplate) systemParts.push(`\n\nFORMULÁRIO PADRÃO:\n${truncate(formTemplate, 4000)}`);
    if (knowledge) systemParts.push(`\n\nBASE DE CONHECIMENTO:\n${truncate(knowledge, 12000)}`);

    const systemText = systemParts.join("\n\n").trim();

    // Parâmetros dinâmicos e defaults
    const openaiPayload = {
      model: env.OPENAI_MODEL || config.model || "gpt-4.1-mini",
      messages: [{ role: "system", content: systemText }, ...messages],
      temperature: typeof config.temperature === "number" ? config.temperature : 0.3,
      top_p: typeof config.top_p === "number" ? config.top_p : 1,
      max_tokens: typeof config.max_tokens === "number" ? config.max_tokens : 700
    };
    if (typeof config.frequency_penalty === "number") openaiPayload.frequency_penalty = config.frequency_penalty;
    if (typeof config.presence_penalty === "number") openaiPayload.presence_penalty = config.presence_penalty;
    if (config.safety_filter !== undefined) openaiPayload.safety = !!config.safety_filter;

    // Chamada à OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(openaiPayload)
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiData?.error?.message || `OpenAI HTTP ${aiResponse.status}`);

    const output = aiData?.choices?.[0]?.message?.content ?? "";

    // Persiste conversa e mensagens no D1 (nao bloqueia a resposta)
    if (sessionId) {
      context.waitUntil(
        persistConversation(env, sessionId, messages, output, summaryInitial, summaryUpdate, config, openaiApiKey, userType)
      );
    }

    return json({ output, session_id: sessionId });

  } catch (error) {
    return json({ error: error.message || "erro interno" }, 500);
  }
}

async function persistConversation(env, sessionId, messages, assistantReply, summaryInitialInstr, summaryUpdateInstr, config, openaiApiKey, userType) {
  try {
    // Upsert conversa, agora com user_type
    if (userType) {
      await env.DB.prepare(`
        INSERT INTO conversations (session_id, updated_at, user_type)
        VALUES (?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      `).bind(sessionId, userType).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO conversations (session_id, updated_at)
        VALUES (?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      `).bind(sessionId).run();
    }

    const conv = await env.DB.prepare(
      "SELECT id, summary FROM conversations WHERE session_id = ?"
    ).bind(sessionId).first();

    if (!conv) return;

    const convId = conv.id;
    const existingSummary = conv.summary || "";

    // Salva a ultima mensagem do usuario e a resposta do assistente
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");

    if (lastUserMsg) {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)"
        ).bind(convId, lastUserMsg.content),
        env.DB.prepare(
          "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)"
        ).bind(convId, assistantReply)
      ]);
    }

    // Atualiza o resumo via OpenAI
    if (!summaryInitialInstr && !summaryUpdateInstr) return;

    const summaryInstruction = existingSummary
      ? `${summaryUpdateInstr}\n\nResumo atual:\n${existingSummary}\n\nNova mensagem do paciente: "${lastUserMsg?.content ?? ''}"\nResposta do agente: "${assistantReply}"`
      : `${summaryInitialInstr}\n\nConversa ate agora:\n${messages.map(m => `${m.role === 'user' ? 'Paciente' : 'Agente'}: ${m.content}`).join('\n')}\nAgente: ${assistantReply}`;

    const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.model || "gpt-4o-mini",
        messages: [{ role: "user", content: summaryInstruction }],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const newSummary = summaryData?.choices?.[0]?.message?.content ?? "";
      if (newSummary) {
        // Tenta extrair o nome do paciente da primeira linha do resumo
        const nameMatch = newSummary.match(/Identifica[cç][aã]o[:\s]+([A-Z][a-zA-Zaáéíóúàèìòùãõâêîôûç ]{2,40})/i)
                       || newSummary.match(/paciente[:\s]+([A-Z][a-zA-Zaáéíóúàèìòùãõâêîôûç ]{2,40})/i);
        const extractedName = nameMatch?.[1]?.trim() || null;

        const updateStmts = [env.DB.prepare(
          "UPDATE conversations SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newSummary, convId)];

        if (extractedName) {
          updateStmts.push(env.DB.prepare(
            "UPDATE conversations SET user_name = ? WHERE id = ? AND (user_name IS NULL OR user_name = '')"
          ).bind(extractedName, convId));
        }

        await env.DB.batch(updateStmts);
      }
    }
  } catch (_) {
    // silencioso — nao quebra a resposta principal
  }
}
