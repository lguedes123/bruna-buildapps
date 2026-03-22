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

    // Busca configuração do D2
    const configResult = await env.DB.prepare(
      "SELECT value FROM configs WHERE key = 'openai_config' LIMIT 1"
    ).first();

    const promptResult = await env.DB.prepare(
      "SELECT value FROM configs WHERE key = 'prompt' LIMIT 1"
    ).first();

    const flowResult = await env.DB.prepare(
      "SELECT value FROM configs WHERE key = 'flow' LIMIT 1"
    ).first();

    if (!configResult) {
      return json({ error: "configuração não encontrada no banco de dados" }, 500);
    }

    const config = JSON.parse(configResult.value);
    const prompt = promptResult?.value || "";
    const flow = flowResult?.value || "";

    const systemText = [prompt, "", "Fluxo:", flow].join("\n").trim();

    if (config.provider === "openai") {
      if (!env.OPENAI_API_KEY) {
        return json({ error: "segredo OpenAI ausente" }, 500);
      }
      const result = await callOpenAI(env.OPENAI_API_KEY, config, systemText, messages);
      return json({ provider: "openai", output: result });
    }

    if (config.provider === "gemini") {
      if (!env.GEMINI_API_KEY) {
        return json({ error: "segredo Gemini ausente" }, 500);
      }
      const result = await callGemini(env.GEMINI_API_KEY, config, systemText, messages);
      return json({ provider: "gemini", output: result });
    }

    return json({ error: "provider inválido" }, 400);
  } catch (error) {
    return json({ error: error.message || "erro interno" }, 500);
  }
}

async function callGemini(apiKey, config, systemText, messages) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: { text: systemText } },
        contents: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: { text: m.content }
        }))
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || "Sem resposta";
}

async function callOpenAI(apiKey, config, systemText, messages) {
  const payload = {
    model: config.model,
    messages: [
      { role: "system", content: systemText },
      ...messages
    ],
    temperature: config.temperature || 0.7,
    top_p: config.top_p || 1,
    max_tokens: config.max_tokens || 2048,
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
      temperature: config.temperature || 0.7,
      topP: config.top_p || 1,
      maxOutputTokens: config.max_tokens || 2048
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