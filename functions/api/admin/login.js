function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function signSession(username, secret) {
  const timestamp = Date.now();
  const data = `${username}|${timestamp}`;

  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const dataBytes = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const sessionData = `${data}|${signatureHex}`;

  return {
    value: btoa(sessionData),
    timestamp,
  };
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

export async function onRequestPost(context) {
  try {
    const env = context.env;
    const body = await context.request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return json({ error: 'Credenciais inválidas' }, 401);
    }

    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      return json({ error: 'Credenciais inválidas' }, 401);
    }

    const { value: sessionValue } = await signSession(username, env.SESSION_SECRET);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `admin_session=${sessionValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
      },
    });
  } catch {
    return json({ error: 'erro interno' }, 500);
  }
}

export { verifySession };
