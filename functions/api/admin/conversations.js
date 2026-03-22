/**
 * GET /api/admin/conversations?page=1&limit=20&search=nome
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

  const url    = new URL(context.request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1'));
  const limit  = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));
  const search = url.searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  try {
    const db = context.env.DB;

    let countRow, rows;

    if (search) {
      const like = `%${search}%`;
      countRow = await db.prepare(
        "SELECT COUNT(*) as total FROM conversations WHERE user_name LIKE ? OR summary LIKE ?"
      ).bind(like, like).first();

      rows = await db.prepare(`
        SELECT id, session_id, user_name, summary, started_at, updated_at,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id) AS message_count
        FROM conversations
        WHERE user_name LIKE ? OR summary LIKE ?
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(like, like, limit, offset).all();
    } else {
      countRow = await db.prepare("SELECT COUNT(*) as total FROM conversations").first();

      rows = await db.prepare(`
        SELECT id, session_id, user_name, summary, started_at, updated_at,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id) AS message_count
        FROM conversations
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all();
    }

    return json({
      conversations: rows.results || [],
      total: countRow?.total || 0,
      page,
      limit
    });

  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  if (!await isAuthorized(context.request, context.env)) return json({ error: "unauthorized" }, 401);

  const url = new URL(context.request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: "id obrigatorio" }, 400);

  try {
    await context.env.DB.prepare(
      "DELETE FROM conversations WHERE id = ?"
    ).bind(parseInt(id)).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
