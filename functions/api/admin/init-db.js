/**
 * Endpoint de inicialização do banco de dados D2 (use uma única vez)
 * POST /api/admin/init-db
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const env = context.env;
  
  // Verificar se já existe dados no banco
  try {
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM configs"
    ).first();

    if (existing?.count > 0) {
      return json({ 
        status: "already_initialized",
        message: "Banco de dados já foi inicializado",
        records: existing.count
      }, 200);
    }

    // Criar tabela
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inserir dados iniciais
    const inserts = [
      {
        key: "openai_config",
        value: JSON.stringify({
          provider: "openai",
          model: "gpt-4o-mini",
          updated_at: new Date().toISOString()
        })
      },
      {
        key: "prompt",
        value: "Você é um assistente médico educacional. Responda dúvidas médicas de forma clara, precisa e sendo empático com quem está aprendendo. Use exemplos práticos quando possível."
      },
      {
        key: "flow",
        value: "1. Coletar história clínica breve\n2. Expandir com perguntas diagnósticas\n3. Fornecer diagnóstico diferencial educativo\n4. Explicar conceitos relevantes"
      },
      {
        key: "public",
        value: JSON.stringify({
          version: "1.0",
          features: ["chat", "education"]
        })
      }
    ];

    for (const item of inserts) {
      await env.DB.prepare(
        "INSERT INTO configs (key, value) VALUES (?, ?)"
      ).bind(item.key, item.value).run();
    }

    return json({
      status: "ok",
      message: "Banco de dados inicializado com sucesso",
      records_inserted: inserts.length
    }, 201);

  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    return json({
      status: "error",
      message: error.message
    }, 500);
  }
}
