-- Criar tabela de configurações
CREATE TABLE IF NOT EXISTS configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configurações iniciais
INSERT OR IGNORE INTO configs (key, value) VALUES
  (
    'openai_config',
    '{"provider":"openai","model":"gpt-4o-mini","updated_at":"2026-01-01T00:00:00.000Z"}'
  ),
  (
    'prompt',
    'Você é um assistente médico educacional desenvolvido para o projeto de pesquisa Unicerrado-UFG. Seu papel é apoiar estudantes de medicina no aprendizado de anamnese e raciocínio clínico. Responda com linguagem clara, didática e empática. Use exemplos práticos, mencione hipóteses diagnósticas e explique os raciocínios de forma pedagógica. Não forneça diagnósticos definitivos — sempre oriente o estudante a validar com um preceptor.'
  ),
  (
    'flow',
    '1. Cumprimentar o paciente e apresentar-se como estudante\n2. Coletar a queixa principal\n3. Investigar a história da doença atual (início, duração, localização, intensidade, fatores de melhora/piora)\n4. Revisar sistemas (cardiovascular, respiratório, gastrointestinal, neurológico)\n5. Coletar antecedentes pessoais (doenças prévias, cirurgias, internações)\n6. Investigar antecedentes familiares\n7. Coletar hábitos de vida (tabagismo, etilismo, atividade física, alimentação)\n8. Verificar uso de medicamentos e alergias\n9. Formular hipóteses diagnósticas junto ao estudante\n10. Orientar próximos passos (exames, encaminhamentos)'
  ),
  (
    'public',
    '{"chatTitle":"Assistente de Anamnese","welcomeMessage":"Olá! 👋 Sou seu assistente de anamnese do projeto Unicerrado-UFG. Vou te ajudar a praticar a coleta de história clínica. Como você gostaria de começar?"}'
  );
