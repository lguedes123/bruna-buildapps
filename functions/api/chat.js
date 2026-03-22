function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  try {
    const env = context.env;
    const body = await context.request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sessionId = body.session_id || null;

    if (!messages.length) return json({ error: "messages e obrigatorio" }, 400);

    // Usa APENAS a variavel de ambiente para API key (nunca do banco)
    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) return json({ error: "OPENAI_API_KEY nao configurada nas variaveis de ambiente" }, 500);

    // Busca configuracoes do D1 em paralelo (sem API key do banco)
    const [configRow, promptRow, flowRow, moderationRow, summaryInitialRow, summaryUpdateRow] = await Promise.all([
      env.DB.prepare("SELECT value FROM configs WHERE key = 'openai_config' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'prompt' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'flow' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'moderation_message' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'summary_initial' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'summary_update' LIMIT 1").first()
    ]);

    const config             = configRow ? JSON.parse(configRow.value) : { model: "gpt-4o-mini" };
    const prompt             = promptRow?.value || "";
    const flow               = flowRow?.value || "";
    const moderationMessage  = moderationRow?.value || "";
    const summaryInitial     = summaryInitialRow?.value || "";
    const summaryUpdate      = summaryUpdateRow?.value || "";

    const systemParts = [prompt];
    if (flow) systemParts.push(`Fluxo:\n${flow}`);
    if (moderationMessage) systemParts.push(
      `Moderacao: Se o paciente enviar conteudo fora do escopo clinico ou linguagem inadequada, responda EXATAMENTE com este texto: "${moderationMessage}"`
    );
    const systemText = systemParts.join("\n\n").trim();

    // Envia para OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.model || "gpt-4o-mini",
        messages: [{ role: "system", content: systemText }, ...messages],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiData?.error?.message || `OpenAI HTTP ${aiResponse.status}`);

    const output = aiData?.choices?.[0]?.message?.content ?? "";

    // Persiste conversa e mensagens no D1 (nao bloqueia a resposta)
    if (sessionId) {
      context.waitUntil(
        persistConversation(env, sessionId, messages, output, summaryInitial, summaryUpdate, config, openaiApiKey)
      );
    }

    return json({ output, session_id: sessionId });

  } catch (error) {
    return json({ error: error.message || "erro interno" }, 500);
  }
}

async function persistConversation(env, sessionId, messages, assistantReply, summaryInitialInstr, summaryUpdateInstr, config, openaiApiKey) {
  try {
    // Upsert conversa
    await env.DB.prepare(`
      INSERT INTO conversations (session_id, updated_at)
      VALUES (?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `).bind(sessionId).run();

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
