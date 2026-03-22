// Lista de modelos OpenAI disponíveis
export const OPENAI_MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Mais inteligente e versátil, melhor para casos complexos",
    tier: "premium"
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Padrão - rápido e econômico, bom para a maioria dos casos",
    tier: "standard",
    default: true
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "Intermediário - boa relação entre inteligência e velocidade",
    tier: "standard"
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    description: "Legado - ainda potente",
    tier: "standard"
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Mais econômico, para tarefas simples",
    tier: "economy"
  }
];

export function getDefaultModel() {
  return OPENAI_MODELS.find(m => m.default)?.id || "gpt-4o-mini";
}

export function validateModel(modelId) {
  return OPENAI_MODELS.some(m => m.id === modelId);
}
