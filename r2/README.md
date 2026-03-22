# R2 Secrets & Configuration

## OpenAI Configuration

O arquivo `secrets/openai.json` contém:
- `provider`: fixo como "openai"
- `model`: modelo selecionado (padrão: "gpt-4o-mini")
- `available_models`: lista de modelos disponíveis
- `api_key`: referência para a variável de ambiente `OPENAI_API_KEY`

## Modelos Disponíveis

- `gpt-4o` — GPT-4 Omni (mais recente e versátil)
- `gpt-4o-mini` — GPT-4 Mini (padrão, balanceado custo/performance)
- `gpt-4-turbo` — GPT-4 Turbo
- `gpt-4` — GPT-4 legado
- `gpt-3.5-turbo` — GPT-3.5 Turbo (mais barato)

## Como Mudar o Modelo

Via endpoint:
```bash
PUT /api/admin/models
Authorization: Cookie admin_session=...

{
  "model": "gpt-4o"
}
```

Lista de modelos disponíveis:
```bash
GET /api/admin/models
Authorization: Cookie admin_session=...
```

Resposta:
```json
{
  "available_models": [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo"
  ],
  "default_model": "gpt-4o-mini"
}
```

## Environment Variables

Obrigatório no Cloudflare Pages:
- `OPENAI_API_KEY` — sua chave de API OpenAI
