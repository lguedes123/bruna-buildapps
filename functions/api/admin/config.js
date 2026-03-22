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

function isAuthorized(request, env) {
  const cookies = parseCookies(request);
  return cookies.admin_session === env.ADMIN_SESSION_TOKEN;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const CONFIG_KEYS = [
  'openai_config',
  'prompt',
  'flow',
  'public',
  'moderation_message',
  'summary_initial',
  'summary_update'
];

export async function onRequestGet(context) {
  if (!isAuthorized(context.request, context.env)) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const placeholders = CONFIG_KEYS.map(() => '?').join(',');
    const results = await context.env.DB.prepare(
      `SELECT key, value FROM configs WHERE key IN (${placeholders})`
    ).bind(...CONFIG_KEYS).all();

    const d = {};
    for (const row of results.results || []) {
      if (row.key === 'openai_config') d.config = safeJsonParse(row.value || '{}', {});
      else if (row.key === 'public') d.public = safeJsonParse(row.value || '{}', {});
      else d[row.key] = row.value || '';
    }

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
    return json({ error: error.message || 'internal_error' }, 500);
  }
}

export async function onRequestPut(context) {
  if (!isAuthorized(context.request, context.env)) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const body = await context.request.json();
    const {
      config,
      prompt,
      flow,
      public: publicData,
      moderation_message,
      summary_initial,
      summary_update
    } = body;

    if (!config || typeof config !== 'object' || !config.model) {
      return json({ error: 'config invalida' }, 400);
    }

    const now = new Date().toISOString();

    const upsert = (key, val) => context.env.DB.prepare(
      `INSERT INTO configs (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(key, val);

    await context.env.DB.batch([
      upsert("openai_config", JSON.stringify({
        ...config,
        provider: "openai",
        model: config.model,
        updated_at: now
      })),
      upsert("prompt", String(prompt ?? '')),
      upsert("flow", String(flow ?? '')),
      upsert("public", JSON.stringify(publicData ?? {})),
      upsert("moderation_message", String(moderation_message ?? '')),
      upsert("summary_initial", String(summary_initial ?? '')),
      upsert("summary_update", String(summary_update ?? ''))
    ]);

    return json({ ok: true, updated_at: now });
  } catch (error) {
    return json({ error: error.message || 'internal_error' }, 500);
  }
}