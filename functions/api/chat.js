export async function onRequestPost(context) {
  try {
    const env = context.env;
    const body = await context.request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return json({ error: "messages é obrigatório" }, 400);
    }

    const [configObj, promptObj, flowObj] = await Promise.all([
      env.BUILDAPPS.get(env.APP_CONFIG_KEY),
      env.BUILDAPPS.get(env.APP_PROMPT_KEY),
      env.BUILDAPPS.get(env.APP_FLOW_KEY)
    ]);

    if (!configObj) {
      return json({ error: "configuração não encontrada no R2" }, 500);
    }

    const config = await configObj.json();
    const prompt = promptObj ? await promptObj.text() : "";
    const flow = flowObj ? await flowObj.text() : "";

    const systemText = [prompt, "", "Fluxo:", flow].join("\n").trim();

    if (config.provider === "openai") {
      const secretObj = await env.BUILDAPPS.get(env.APP_SECRET_OPENAI_KEY);
      if (!secretObj) return json({ error: "segredo OpenAI ausente" }, 500);

      const secret = await secretObj.json();
      const result = await callOpenAI(secret.api_key, config, systemText, messages);
      return json({ provider: "openai", output: result });
    }

    if (config.provider === "gemini") {
      const secretObj = await env.BUILDAPPS.get(env.APP_SECRET_GEMINI_KEY);
      if (!secretObj) return json({ error: "segredo Gemini ausente" }, 500);

      const secret = await secretObj.json();
      const result = await callGemini(secret.api_key, config, systemText, messages);
      return json({ provider: "gemini", output: result });
    }

    return json({ error: "provider inválido" }, 400);
  } catch (error) {
    return json({ error: error.message || "erro interno" }, 500);
  }
}

async function callOpenAI(apiKey, config, systemText, messages) {
  const payload = {
    model: config.model,
    messages: [
      { role: "system", content: systemText },
      ...messages
    ],
    temperature: config.temperature,
    top_p: config.top_p,
    max_tokens: config.max_tokens,
    frequency_penalty: config.frequency_penalty ?? 0,
    presence_penalty: config.presence_penalty ?? 0
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(apiKey, config, systemText, messages) {
  const contents = [
    {
      role: "user",
      parts: [{ text: `SYSTEM:\n${systemText}` }]
    },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }))
  ];

  const payload = {
    contents,
    generationConfig: {
      temperature: config.temperature,
      topP: config.top_p,
      maxOutputTokens: config.max_tokens
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: config?.safety?.hate || "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: config?.safety?.harassment || "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: config?.safety?.sexual || "BLOCK_ONLY_HIGH"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: config?.safety?.dangerous || "BLOCK_ONLY_HIGH"
      }
    ]
  };

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  }

  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ?? "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}