

// Novo endpoint para checagem de CPF
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/check-cpf') && request.method === 'POST') {
    try {
      const body = await request.json();
      const cpf = (body.cpf || '').replace(/\D/g, '');
      const profissionalCpf = (body.profissional_cpf || '').replace(/\D/g, '');
      const userType = body.user_type;
      let exists = false, nome = null;
      if (userType === 'paciente' && cpf) {
        const row = await env.DB.prepare("SELECT user_name FROM conversations WHERE cpf = ? LIMIT 1").bind(cpf).first();
        if (row && row.user_name) {
          exists = true;
          nome = row.user_name;
        } else {
          // Se paciente não encontrado, cria registro na tabela
          await env.DB.prepare("INSERT INTO conversations (created_at, updated_at, user_type, cpf, user_name) VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?) ON CONFLICT(cpf) DO UPDATE SET updated_at = CURRENT_TIMESTAMP")
            .bind(userType, cpf, body.user_name || null)
            .run();
        }
      } else if ((userType === 'medico' || userType === 'profissional') && cpf && profissionalCpf) {
        const row = await env.DB.prepare("SELECT user_name FROM conversations WHERE cpf = ? AND profissional_cpf = ? LIMIT 1").bind(cpf, profissionalCpf).first();
        if (row && row.user_name) {
          exists = true;
          nome = row.user_name;
        } else {
          // Se profissional não encontrado, cria registro na tabela
          await env.DB.prepare("INSERT INTO conversations (created_at, updated_at, user_type, cpf, profissional_cpf, user_name) VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?) ON CONFLICT(cpf, profissional_cpf) DO UPDATE SET updated_at = CURRENT_TIMESTAMP")
            .bind(userType, cpf, profissionalCpf, body.user_name || null)
            .run();
        }
      }
      return json({ exists, nome });
    } catch {
      return json({ exists: false });
    }
  }
}

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
    let openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // fallback para DB configs.fetch: openai_api_key
      try {
        const row = await env.DB.prepare("SELECT value FROM configs WHERE key = ? LIMIT 1").bind("openai_api_key").first();
        if (row && row.value) {
          openaiApiKey = row.value;
        }
      } catch (fetchErr) {
        console.error("openai_api_key fetch error", fetchErr);
      }
    }

    // rejeita placeholder típico e valores inválidos
    if (openaiApiKey && typeof openaiApiKey === 'string') {
      const isPlaceholder = openaiApiKey.startsWith('sk-seu-') || openaiApiKey.includes('****************');
      const isShort = openaiApiKey.length < 40;
      if (isPlaceholder || isShort) {
        console.error('API key invalida detectada em openaiApiKey', openaiApiKey);
        openaiApiKey = null;
      }
    }

    if (!openaiApiKey) return json({ error: "OPENAI_API_KEY nao configurada em variavel de ambiente nem no DB configs ou chave invalida" }, 500);

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


async function persistConversation(env, sessionId, messages, assistantReply, summaryInitialInstr, summaryUpdateInstr, config, openaiApiKey, userType, cpf, profissionalCpf, userName) {
    // Remove marcações markdown básicas do texto
    function stripMarkdown(text) {
      if (!text) return '';
      return text
        .replace(/[#*_`~>-]+/g, '') // remove #, *, _, `, ~, >, -
        .replace(/\n{2,}/g, '\n') // remove quebras de linha duplas
        .replace(/\s{2,}/g, ' ')   // espaços duplos
        .trim();
    }
  // Utilidades locais
  function fillTemplate(template, data) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => data[key] ?? '');
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
  const cache = {};
  try {
    // Upsert conversa, agora com user_type, cpf, profissional_cpf, user_name
    let insertSql = "INSERT INTO conversations (session_id, updated_at";
    let insertVals = [sessionId];
    let insertQ = "?";
    if (userType) { insertSql += ", user_type"; insertVals.push(userType); insertQ += ",?"; }
    if (cpf) { insertSql += ", cpf"; insertVals.push(cpf); insertQ += ",?"; }
    if (profissionalCpf) { insertSql += ", profissional_cpf"; insertVals.push(profissionalCpf); insertQ += ",?"; }
    if (userName) { insertSql += ", user_name"; insertVals.push(userName); insertQ += ",?"; }
    insertSql += ") VALUES (CURRENT_TIMESTAMP," + insertQ + ") ON CONFLICT(session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP";
    await env.DB.prepare(insertSql).bind(...insertVals).run();


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

    // Atualiza o resumo usando o template do R2
    const formTemplate = await getText(env, "templates/form.txt", cache);
    if (formTemplate) {
      // Monta dados básicos para preencher o template
      const data = {
        resumo: assistantReply,
        ultima_mensagem: lastUserMsg?.content || '',
        user_type: userType || '',
        conversa: messages.map(m => `${m.role}: ${m.content}`).join('\n')
      };
      const filled = fillTemplate(formTemplate, data);
      const cleanFilled = stripMarkdown(filled);
      await env.DB.prepare(
        "UPDATE conversations SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(cleanFilled, convId).run();
    } else {
      // fallback: mantém lógica anterior
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
          const cleanSummary = stripMarkdown(newSummary);
          // Tenta extrair o nome do paciente da primeira linha do resumo
          const nameMatch = cleanSummary.match(/Identifica[cç][aã]o[:\s]+([A-Z][a-zA-Zaáéíóúàèìòùãõâêîôûç ]{2,40})/i)
                             || cleanSummary.match(/paciente[:\s]+([A-Z][a-zA-Zaáéíóúàèìòùãõâêîôûç ]{2,40})/i);
          const extractedName = nameMatch?.[1]?.trim() || null;
          const updateStmts = [env.DB.prepare(
            "UPDATE conversations SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(cleanSummary, convId)];
          if (extractedName) {
            updateStmts.push(env.DB.prepare(
              "UPDATE conversations SET user_name = ? WHERE id = ? AND (user_name IS NULL OR user_name = '')"
            ).bind(extractedName, convId));
          }
          await env.DB.batch(updateStmts);
        }
      }
    }
  } catch (_) {
    // silencioso — nao quebra a resposta principal
  }
}
