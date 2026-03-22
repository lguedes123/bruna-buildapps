/**
 * GET /api/admin/conversation?id=123
 * Retorna uma conversa especifica com todas as mensagens
 */

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
  if (!isAuthorized(context.request)) return json({ error: "unauthorized" }, 401);

  const url = new URL(context.request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: "id obrigatorio" }, 400);

  try {
    const db = context.env.DB;

    const conv = await db.prepare(
      "SELECT id, session_id, user_name, summary, started_at, updated_at FROM conversations WHERE id = ?"
    ).bind(parseInt(id)).first();

    if (!conv) return json({ error: "conversa nao encontrada" }, 404);

    const msgs = await db.prepare(
      "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).bind(parseInt(id)).all();

    return json({
      conversation: conv,
      messages: msgs.results || []
    });

  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
