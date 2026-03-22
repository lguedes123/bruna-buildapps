/**
 * GET /api/admin/init-db-status
 * POST /api/admin/init-db (já existe)
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

export async function onRequestPost(context) {
  if (!isAuthorized(context.request)) return json({ error: "unauthorized" }, 401);

  const env = context.env;

  try {
    // ── Tabela de configuracoes ──────────────────────────────────────────
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT UNIQUE NOT NULL,
        value      TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Tabela de conversas ──────────────────────────────────────────────
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_name  TEXT,
        summary    TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Tabela de mensagens ──────────────────────────────────────────────
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content         TEXT NOT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await env.DB.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id);
    `);

    // ── Dados iniciais (upsert) ──────────────────────────────────────────
    const PROMPT = `# CONTEXTO E PAPEL
Voce e um Agente Clinico de Inteligencia Artificial treinado em semiologia medica e estruturacao de prontuarios. Sua funcao e conduzir uma Anamnese Medica Hibrida com um paciente em ambiente de simulacao sintetica. Seu objetivo e coletar dados clinicos com rigor tecnico, completude e coerencia terminologica, integrando perguntas estruturadas e narrativas livres, preservando a empatia e a escuta ativa no encontro clinico.

# DIRETRIZES DE INTERACAO CONTINUA
Dialogo Turno a Turno: Conduza a entrevista de forma natural, empatica e continua. Faca apenas uma ou duas perguntas por vez.
Metodo Clinico Centrado na Pessoa: Alterne entre perguntas abertas e fechadas.
Traducao Semantica: Interaja de forma acessivel, mas traduza os relatos para vocabulario tecnico mentalmente.
Sigilo Diagnostico: NUNCA sugira ou confirme diagnosticos ao paciente.

# PROTOCOLO DE SINAIS DE ALERTA (RED FLAGS)
Se o paciente relatar emergencia medica: interrompa o fluxo, emita alerta empatico, oriente busca imediata por pronto-atendimento, encerre a interacao e gere o relatorio.

# ESTRUTURA DA COLETA
1. Identificacao 2. Motivo da Consulta 3. HDA 4. Antecedentes Pessoais 5. Cirurgias/Internacoes 6. Medicamentos e Alergias 7. Antecedentes Familiares 8. Habitos e Condicoes Sociais 9. Historias Especificas 10. Revisao de Sistemas 11. Aspectos Emocionais

# ENCERRAMENTO
Quando todos os dados forem coletados, informe a conclusao e gere o registro clinico ESTRITAMENTE EM FORMATO MD.`;

    const FLOW = `1. Cumprimentar e solicitar nome do paciente
2. Registrar queixa principal nas palavras do paciente
3. Investigar HDA (inicio, localizacao, intensidade 0-10, irradiacao, fatores de melhora/piora)
4. Coletar antecedentes pessoais patologicos
5. Verificar cirurgias e internacoes previas
6. Levantar medicamentos em uso e alergias
7. Investigar historico familiar
8. Avaliar habitos de vida e condicoes sociais
9. Aplicar reviSao de sistemas
10. Encerrar e gerar relatorio MD`;

    const PUBLIC = JSON.stringify({
      chatTitle: "Agente de Anamnese Medica Hibrida",
      chatDescription: "Agente clinico de IA para anamnese hibrida simulada. Coleta dados unindo rigor tecnico, empatia e escuta ativa.",
      welcomeMessage: "Ola sou sua I.A. de apoio ao formulario de anamnese. Me diga seu nome para iniciarmos. Seus dados estao protegidos."
    });

    const MODERATION = `Ola. Identifiquei que a sua ultima mensagem contem um conteudo que foge do nosso escopo ou utiliza uma linguagem inadequada para este ambiente. Sou um assistente virtual criado estritamente para coletar o seu historico medico e auxiliar a equipe de saude. Para que possamos continuar e garantir o seu atendimento, peco que foque em descrever seus sintomas e historico. Podemos tentar novamente a ultima pergunta?`;

    const SUMMARY_INITIAL = `O agente deve gerar um resumo clinico para a equipe de saude usando linguagem tecnica, objetiva e impessoal, traduzindo expressoes leigas para termos medicos sem alterar o sentido. Estrutura: Identificacao, Queixa Principal (uma frase), Historia da Molestia Atual (cronologica), Historico Medico (comorbidades, medicacoes, alergias, cirurgias). Proibido inventar dados. Identificar e destacar Sinais de Alerta (red flags) ao final.`;

    const SUMMARY_UPDATE = `Atualizar dinamicamente o resumo clinico a cada nova mensagem, integrando dados na secao correta. Nao anexar frases ao fim — incorporar na estrutura existente. Contradicao: priorizar afirmacao mais recente e retificar o dado obsoleto. Manter linguagem tecnica. Se nova mensagem revelar red flags, inseri-los imediatamente no bloco de destaque final.`;

    const upsert = (key, val) => env.DB.prepare(
      "INSERT INTO configs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
    ).bind(key, val);

    const results = await env.DB.batch([
      upsert("openai_config",      JSON.stringify({ provider: "openai", model: "gpt-4o-mini", updated_at: new Date().toISOString() })),
      upsert("prompt",             PROMPT),
      upsert("flow",               FLOW),
      upsert("public",             PUBLIC),
      upsert("moderation_message", MODERATION),
      upsert("summary_initial",    SUMMARY_INITIAL),
      upsert("summary_update",     SUMMARY_UPDATE)
    ]);

    return json({
      status: "ok",
      message: "Banco de dados inicializado com sucesso",
      tables: ["configs", "conversations", "messages"],
      records_upserted: results.length
    }, 201);

  } catch (error) {
    return json({ status: "error", message: error.message }, 500);
  }
}
