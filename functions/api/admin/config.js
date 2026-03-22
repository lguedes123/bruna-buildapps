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

const CONFIG_KEYS = "'openai_config','prompt','flow','public','moderation_message','summary_initial','summary_update'";

export async function onRequestGet(context) {
  if (!isAuthorized(context.request)) return json({ error: "unauthorized" }, 401);

  try {
    const results = await context.env.DB.prepare(
      `SELECT key, value FROM configs WHERE key IN (${CONFIG_KEYS})`
    ).all();

    const d = {};
    results.results?.forEach(row => {
      if (row.key === 'openai_config') d.config = JSON.parse(row.value || '{}');
      else if (row.key === 'public') d.public = JSON.parse(row.value || '{}');
      else d[row.key] = row.value || '';
    });

    return json({
      config: d.config || {},
      prompt: d.prompt || '',
      flow: d.flow || '',
      public: d.public || {},
      moderation_message: d.moderation_message || '',
      summary_initial: d.summary_initial || '',
      summary_update: d.summary_update || ''
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestPut(context) {
  if (!isAuthorized(context.request)) return json({ error: "unauthorized" }, 401);

  const body = await context.request.json();
  const { config, prompt, flow, public: publicData, moderation_message, summary_initial, summary_update } = body;

  if (!config?.model) return json({ error: "config invalida" }, 400);

  const now = new Date().toISOString();

  const upsert = (key, val) => context.env.DB.prepare(
    "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
  ).bind(key, val);

  try {
    await Promise.all([
      upsert("openai_config",       JSON.stringify({ provider: "openai", model: config.model, updated_at: now })).run(),
      upsert("prompt",              String(prompt              ?? '')).run(),
      upsert("flow",                String(flow                ?? '')).run(),
      upsert("public",              JSON.stringify(publicData  ?? {})).run(),
      upsert("moderation_message",  String(moderation_message  ?? '')).run(),
      upsert("summary_initial",     String(summary_initial     ?? '')).run(),
      upsert("summary_update",      String(summary_update      ?? '')).run()
    ]);

    return json({ ok: true, updated_at: now });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
