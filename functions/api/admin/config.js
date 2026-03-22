export async function onRequestGet(context) {
  const authorized = isAuthorized(context.request);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const env = context.env;

  const [configObj, promptObj, flowObj, publicObj] = await Promise.all([
    env.BUILDAPPS.get(env.APP_CONFIG_KEY),
    env.BUILDAPPS.get(env.APP_PROMPT_KEY),
    env.BUILDAPPS.get(env.APP_FLOW_KEY),
    env.BUILDAPPS.get(env.APP_PUBLIC_KEY)
  ]);

  const config = configObj ? await configObj.json() : {};
  const prompt = promptObj ? await promptObj.text() : "";
  const flow = flowObj ? await flowObj.text() : "";
  const publicData = publicObj ? await publicObj.json() : {};

  return json({
    config,
    prompt,
    flow,
    public: publicData
  });
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
    public: publicData,
    secrets
  } = body;

  if (!config || !config.provider || !config.model) {
    return json({ error: "config inválida" }, 400);
  }

  config.updated_at = new Date().toISOString();

  const puts = [
    env.BUILDAPPS.put(
      env.APP_CONFIG_KEY,
      JSON.stringify(config, null, 2),
      { httpMetadata: { contentType: "application/json" } }
    ),
    env.BUILDAPPS.put(
      env.APP_PROMPT_KEY,
      String(prompt ?? ""),
      { httpMetadata: { contentType: "text/plain; charset=utf-8" } }
    ),
    env.BUILDAPPS.put(
      env.APP_FLOW_KEY,
      String(flow ?? ""),
      { httpMetadata: { contentType: "text/plain; charset=utf-8" } }
    ),
    env.BUILDAPPS.put(
      env.APP_PUBLIC_KEY,
      JSON.stringify(publicData ?? {}, null, 2),
      { httpMetadata: { contentType: "application/json" } }
    )
  ];

  if (secrets?.openai?.api_key) {
    puts.push(
      env.BUILDAPPS.put(
        env.APP_SECRET_OPENAI_KEY,
        JSON.stringify({ api_key: secrets.openai.api_key }, null, 2),
        { httpMetadata: { contentType: "application/json" } }
      )
    );
  }

  if (secrets?.gemini?.api_key) {
    puts.push(
      env.BUILDAPPS.put(
        env.APP_SECRET_GEMINI_KEY,
        JSON.stringify({ api_key: secrets.gemini.api_key }, null, 2),
        { httpMetadata: { contentType: "application/json" } }
      )
    );
  }

  await Promise.all(puts);

  return json({ ok: true, updated_at: config.updated_at });
}

function isAuthorized(request) {
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