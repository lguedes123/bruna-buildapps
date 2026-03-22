/**
 * GET /api/admin/init-db-status
 * POST /api/admin/init-db (já existe)
 * ALTER TABLE para adicionar campos cpf e profissional_cpf
// Query para adicionar campos cpf e profissional_cpf:
// ALTER TABLE conversations ADD COLUMN cpf TEXT DEFAULT NULL;
// ALTER TABLE conversations ADD COLUMN profissional_cpf TEXT DEFAULT NULL;
 */

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
  if (!await isAuthorized(context.request, context.env)) return json({ error: "unauthorized" }, 401);

  try {
    // Checa se as tabelas existem
    const result = await context.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('configs', 'conversations', 'messages')"
    ).all();

    const tables = (result.results || []).map(r => r.name);
    const initialized = tables.length === 3;

    return json({
      initialized,
      tables_found: tables,
      message: initialized
        ? "Banco ja esta inicializado com todas as tabelas."
        : `Faltam tabelas. Encontradas: ${tables.join(', ') || 'nenhuma'}`
    });
  } catch (error) {
    return json({ 
      initialized: false, 
      error: error.message,
      message: "Erro ao verificar status do banco." 
    }, 500);
  }
}


