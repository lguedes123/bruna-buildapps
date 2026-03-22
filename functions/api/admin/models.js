import { OPENAI_MODELS, getDefaultModel, validateModel } from "../../config/models.js";

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
    default_model: getDefaultModel()
  });
}

export async function onRequestPut(context) {
  const authorized = isAuthorized(context.request);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await context.request.json();
  const { model } = body;

  if (!model || !validateModel(model)) {
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

  try {
    await env.DB.prepare(
      "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
    ).bind("openai_config", JSON.stringify(openaiConfig)).run();

    return json({
      ok: true,
      model: model,
      message: "modelo OpenAI atualizado"
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
