/**
 * GET /api/chat/public
 * Retorna dados públicos do chat (título, mensagem de boas-vindas)
 * Sem autenticação — acessível pelo frontend público
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  try {
    const result = await context.env.DB.prepare(
      "SELECT value FROM configs WHERE key = 'public' LIMIT 1"
    ).first();

    if (!result) {
      return json({
        chatTitle: "Assistente de Anamnese",
        welcomeMessage: "Olá! 👋 Sou seu assistente de anamnese. Como posso ajudar?"
      });
    }

    const data = JSON.parse(result.value || '{}');
    return json({
      chatTitle: data.chatTitle || "Assistente de Anamnese",
      welcomeMessage: data.welcomeMessage || "Olá! Como posso ajudar?"
    });
  } catch {
    return json({
      chatTitle: "Assistente de Anamnese",
      welcomeMessage: "Olá! 👋 Como posso ajudar?"
    });
  }
}
