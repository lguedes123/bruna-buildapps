# BuildApps Chatbot

Chatbot com Cloudflare Pages + Pages Functions + R2.

## Estrutura
- `public/`: frontend estático (HTML, CSS, JS)
- `functions/`: rotas serverless (Pages Functions)
- `r2/`: configuração e templates para o bucket R2
- `wrangler.toml`: manifest de deployment

## Bindings
- `BUILDAPPS` → bucket R2 `buildapps`

## Variáveis de Ambiente
- `APP_CONFIG_KEY`: path para config.json (padrão: `config.json`)
- `APP_PROMPT_KEY`: path para prompt.txt (padrão: `prompt.txt`)
- `APP_FLOW_KEY`: path para flow.txt (padrão: `flow.txt`)
- `APP_PUBLIC_KEY`: path para public.json (padrão: `public.json`)
- `APP_SECRET_OPENAI_KEY`: path para secrets/openai.json (padrão: `secrets/openai.json`)
- `APP_SECRET_GEMINI_KEY`: path para secrets/gemini.json (padrão: `secrets/gemini.json`)

## Deploy no Cloudflare Pages

### Pré-requisitos
1. Conta no [Cloudflare](https://cloudflare.com)
2. Projeto Pages criado
3. Bucket R2 criado chamado `buildapps`
4. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) instalado

### Passos
1. Clone/fork este repositório
2. Configure as variáveis de ambiente no painel do Pages:
   - Vá para **Settings > Environment variables**
   - Adicione todas as `APP_*` keys com seus respetivos paths
3. Configure o R2 binding no painel:
   - Vá para **Settings > Functions > R2 namespace bindings**
   - Binding: `BUILDAPPS`
   - Bucket: `buildapps`
4. Faça upload dos arquivos para o R2:
   - `r2/config.json`
   - `r2/prompt.txt`
   - `r2/flow.txt`
   - `r2/public.json`
   - `r2/secrets/openai.json`
   - `r2/secrets/gemini.json`
5. Atualize os secrets com valores reais (substitua `${OPENAI_API_KEY}`, etc.)
6. Deploy automático ao fazer push para GitHub ou:
   ```bash
   npm run deploy
   ```

## Desenvolvimento Local
```bash
npm run dev
```
Abre o servidor em `http://localhost:8788`

## Estrutura de Handlers
- `functions/api/chat.js`: endpoint POST `/api/chat` para interações
- `functions/api/admin/config.js`: configurações administrativas