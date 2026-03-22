const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.includes('admin_session=');
}

export async function onRequestGet(context) {
  const authorized = isAuthorized(context.request);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  return json({
    available_models: OPENAI_MODELS,
    default_model: "gpt-4o-mini"
  });
}

export async function onRequestPut(context) {
  const authorized = isAuthorized(context.request);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await context.request.json();
  const { model } = body;

  if (!model || !OPENAI_MODELS.includes(model)) {
    return json({
      error: "modelo inválido",
      available_models: OPENAI_MODELS
    }, 400);
  }

  const env = context.env;

  const openaiConfig = {
    provider: "openai",
    model: model,
    updated_at: new Date().toISOString()
  };

  await env.BUILDAPPS.put(env.APP_SECRET_OPENAI_KEY, JSON.stringify(openaiConfig));

  return json({
    ok: true,
    model: model,
    message: "modelo OpenAI atualizado"
  });
}
