-- Criar tabela de configurações
CREATE TABLE IF NOT EXISTS configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configurações iniciais
INSERT OR IGNORE INTO configs (key, value) VALUES
  ('openai_config', '{"provider":"openai","model":"gpt-4o-mini","updated_at":"' || datetime('now') || '"}'),
  ('prompt', 'Você é um assistente médico educacional. Responda dúvidas médicas de forma clara, precisa e sendo empático com quem está aprendendo. Use exemplos práticos quando possível.'),
  ('flow', '1. Coletar história clínica breve\n2. Expandir com perguntas diagnósticas\n3. Fornecer diagnóstico diferencial educativo\n4. Explicar conceitos relevantes'),
  ('public', '{"version":"1.0","features":["chat","education"]}');
