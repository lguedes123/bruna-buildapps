# BuildApps Chatbot

Chatbot educacional médico com Cloudflare Pages + D2 Database.

## Estrutura
- `public/`: frontend estático (HTML, CSS, JS)
- `functions/`: rotas serverless (Pages Functions)
- `functions/api/`: endpoints REST
- `functions/config/`: configuração e helpers
- `functions/db/`: schema e instruções de banco de dados
- `wrangler.toml`: manifest de deployment

## Bindings
- `DB` → banco D2 `bruna-buildapps`

## Tecnologia
- **Backend**: Cloudflare Pages Functions (Workers runtime)
- **Database**: Cloudflare D2 (SQLite serverless)
- **Frontend**: HTML + CSS + Vanilla JS
- **APIs de IA**: OpenAI (gpt-4o, gpt-4o-mini, etc) + Gemini (fallback)
- **Autenticação**: HMAC-SHA256 sessions com cookies

## Variáveis de Ambiente
```env
ADMIN_USERNAME=admin              # Usuário para painel admin
ADMIN_PASSWORD=senha_segura       # Senha do admin
SESSION_SECRET=random_hex_32      # Chave para assinar sessions (gerar: openssl rand -hex 32)
OPENAI_API_KEY=sk-...             # API key do OpenAI
GEMINI_API_KEY=gcloud_api_key     # API key do Gemini (opcional)
```

## Banco de Dados D2

Tabela `configs`:
```sql
CREATE TABLE configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Chaves obrigatórias:
- `openai_config`: JSON com provider, modelo e timestamp
- `prompt`: Prompt de sistema (texto)
- `flow`: Fluxo de conversação (texto)
- `public`: Dados públicos da app (JSON)

## Deploy no Cloudflare Pages

### Pré-requisitos
1. Conta no [Cloudflare](https://cloudflare.com)
2. Projeto Pages criado
3. Banco D2 criado: `bruna-buildapps`
4. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) instalado

### Passos

1. **Clone/fork este repositório**
   ```bash
   git clone https://github.com/seu-username/bruna-buildapps.git
   cd bruna-buildapps
   ```

2. **Crie o banco de dados D2**
   ```bash
   wrangler d1 create bruna-buildapps
   ```
   Anote o ID do banco (aparecerá na saída)

3. **Atualize `wrangler.toml`** com o ID do seu banco:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "bruna-buildapps"
   database_id = "seu-id-aqui"
   ```

4. **Configure as variáveis de ambiente** no painel do Cloudflare Pages:
   - Vá para **Settings > Environment variables**
   - Adicione em **Production**:
     - `ADMIN_USERNAME`
     - `ADMIN_PASSWORD`
     - `SESSION_SECRET` (gerar: `openssl rand -hex 32`)
     - `OPENAI_API_KEY`
     - `GEMINI_API_KEY` (opcional)

5. **Inicialize o banco de dados** (após primeiro deploy):
   ```bash
   curl -X POST https://seu-projeto.pages.dev/api/admin/init-db
   ```
   Resposta esperada: `{"status":"ok","records_inserted":4}`

6. **Deploy à Cloudflare Pages**:
   ```bash
   npm run deploy
   ```
   Ou ative CI/CD pelo painel Pages (conectar GitHub)

### Testar Admin Panel
1. Acesse: `https://seu-projeto.pages.dev/login.html`
2. Use credenciais: `ADMIN_USERNAME` e `ADMIN_PASSWORD`
3. Após login, acesse `/admin.html` para gerenciar configs

## Desenvolvimento Local
```bash
npm run dev
```
Abre o servidor em `http://localhost:8788`

## Estrutura de Handlers
- `functions/api/chat.js`: endpoint POST `/api/chat` para interações
- `functions/api/admin/config.js`: configurações administrativas