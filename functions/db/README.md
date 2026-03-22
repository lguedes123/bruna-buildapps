# Cloudflare D2 Database Setup

## Sobre
O projeto foi migrado de **R2 (Object Storage)** para **D2 (SQL Database)** para melhor gerenciamento de configurações estruturadas.

## Inicializar o Banco D2

### 1. Primeira vez após deploy

Acesse:
```
POST https://seu-projeto.pages.dev/api/admin/init-db
```

Resposta esperada:
```json
{
  "status": "ok",
  "message": "Banco de dados inicializado com sucesso",
  "records_inserted": 4
}
```

### 2. Estrutura de Dados

Tabela `configs`:
```sql
CREATE TABLE configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Dados Iniciais

| key | value | descrição |
|-----|-------|-----------|
| `openai_config` | JSON | Configuração do modelo OpenAI, ex: `{"provider":"openai","model":"gpt-4o-mini"}` |
| `prompt` | TEXT | Prompt de sistema para o assistente médico |
| `flow` | TEXT | Fluxo de conversação (instruções passo a passo) |
| `public` | JSON | Dados públicos da aplicação |

## Operações via API Admin

### GET /api/admin/config
Retorna todas as configurações:
```bash
curl -b "admin_session=..." https://seu-projeto.pages.dev/api/admin/config
```

### PUT /api/admin/config
Atualiza configurações:
```bash
curl -X PUT -b "admin_session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "config": {"provider":"openai","model":"gpt-4o"},
    "prompt": "Novo prompt...",
    "flow": "Novo fluxo...",
    "public": {}
  }' \
  https://seu-projeto.pages.dev/api/admin/config
```

### GET /api/admin/models
Lista modelos disponíveis

### PUT /api/admin/models
Atualiza modelo selecionado:
```bash
curl -X PUT -b "admin_session=..." \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o"}' \
  https://seu-projeto.pages.dev/api/admin/models
```

## Variáveis de Ambiente Necessárias

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha
SESSION_SECRET=random_hex_32_bytes
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=gcloud_api_key
```

## Troubleshooting

Se receber erro "Unauthorized" ao chamar `/api/admin/init-db`:
- Na primeira vez, esse endpoint deveria estar acessível
- Se quiser restringir, adicione verificação de Bearer token ou IP whitelist

Se receber erro "Table already exists":
- É normal na segunda chamada, execute novamente para obter `already_initialized`

Se dados não persistem:
- Verificar se o D2 binding está correto em `wrangler.toml`
- Confirmar que o ID do banco está correto
