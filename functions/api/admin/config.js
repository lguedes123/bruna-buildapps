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

  const env = context.env;

  try {
    const results = await env.DB.prepare(
      "SELECT key, value FROM configs WHERE key IN ('openai_config', 'prompt', 'flow', 'public')"
    ).all();

    const configData = {};
    results.results?.forEach(row => {
      if (row.key === 'openai_config') {
        configData.config = JSON.parse(row.value || '{}');
      } else if (row.key === 'prompt') {
        configData.prompt = row.value || '';
      } else if (row.key === 'flow') {
        configData.flow = row.value || '';
      } else if (row.key === 'public') {
        configData.public = JSON.parse(row.value || '{}');
      }
    });

    return json({
      config: configData.config || {},
      prompt: configData.prompt || "",
      flow: configData.flow || "",
      public: configData.public || {}
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestPut(context) {
  const authorized = isAuthorized(context.request);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const env = context.env;
  const body = await context.request.json();

  const {
    config,
    prompt,
    flow,
    public: publicData
  } = body;

  if (!config || !config.provider || !config.model) {
    return json({ error: "config inválida" }, 400);
  }

  config.updated_at = new Date().toISOString();

  try {
    const updates = [
      env.DB.prepare(
        "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind("openai_config", JSON.stringify(config, null, 2)),

      env.DB.prepare(
        "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind("prompt", String(prompt ?? "")),

      env.DB.prepare(
        "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind("flow", String(flow ?? "")),

      env.DB.prepare(
        "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind("public", JSON.stringify(publicData ?? {}, null, 2))
    ];

    await Promise.all(updates.map(q => q.run()));

    return json({ ok: true, updated_at: config.updated_at });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
  const expected = request.headers.get("x-admin-token");
  return expected && expected === "buildapps-admin-2026";
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