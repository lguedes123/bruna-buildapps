import { OPENAI_MODELS, getDefaultModel, validateModel } from "../../config/models.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  return Object.fromEntries(
    raw.split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf('=');
        return i === -1 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)];
      })
  );
}

async function verifySession(sessionCookie, secret) {
  try {
    const decodedSession = atob(sessionCookie);
    const parts = decodedSession.split('|');

    if (parts.length !== 3) return null;

    const [username, timestamp, signature] = parts;
    const now = Date.now();
    const sessionAge = now - parseInt(timestamp, 10);

    if (sessionAge > 86400000) return null;

    const data = `${username}|${timestamp}`;
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    const dataBytes = encoder.encode(data);

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);

    return isValid ? { username, timestamp: parseInt(timestamp, 10) } : null;
  } catch {
    return null;
  }
}

async function isAuthorized(request, env) {
  const cookies = parseCookies(request);
  const sessionCookie = cookies.admin_session;
  if (!sessionCookie) return false;
  const session = await verifySession(sessionCookie, env.SESSION_SECRET);
  return !!session;
}

export async function onRequestGet(context) {
  const authorized = await isAuthorized(context.request, context.env);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  return json({
    available_models: OPENAI_MODELS,
    default_model: getDefaultModel()
  });
}

export async function onRequestPut(context) {
  const authorized = await isAuthorized(context.request, context.env);
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
