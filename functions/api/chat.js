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

    if (!messages.length) {
      return json({ error: "messages é obrigatório" }, 400);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY não configurada" }, 500);
    }

    // Busca configuração do D2
    const [configResult, promptResult, flowResult] = await Promise.all([
      env.DB.prepare("SELECT value FROM configs WHERE key = 'openai_config' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'prompt' LIMIT 1").first(),
      env.DB.prepare("SELECT value FROM configs WHERE key = 'flow' LIMIT 1").first()
    ]);

    const config = configResult ? JSON.parse(configResult.value) : { model: "gpt-4o-mini" };
    const prompt = promptResult?.value || "";
    const flow = flowResult?.value || "";

    const systemText = flow
      ? `${prompt}\n\nFluxo:\n${flow}`.trim()
      : prompt.trim();

    const payload = {
      model: config.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemText },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
    }

    const output = data?.choices?.[0]?.message?.content ?? "";
    return json({ output });

  } catch (error) {
    return json({ error: error.message || "erro interno" }, 500);
  }
}