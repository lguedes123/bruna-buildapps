const $ = (id) => document.getElementById(id);

$("loadBtn").addEventListener("click", loadConfig);
$("saveBtn").addEventListener("click", saveConfig);

async function loadConfig() {
  const token = $("adminToken").value.trim();

  const response = await fetch("/api/admin/config", {
    headers: { "x-admin-token": token }
  });

  const data = await response.json();
  $("status").textContent = JSON.stringify(data, null, 2);

  if (!response.ok) return;

  const c = data.config || {};
  const p = data.public || {};

  $("provider").value = c.provider || "openai";
  $("model").value = c.model || "";
  $("temperature").value = c.temperature ?? 0.3;
  $("top_p").value = c.top_p ?? 1;
  $("max_tokens").value = c.max_tokens ?? 700;
  $("frequency_penalty").value = c.frequency_penalty ?? 0;
  $("presence_penalty").value = c.presence_penalty ?? 0;

  $("safety_hate").value = c.safety?.hate || "BLOCK_ONLY_HIGH";
  $("safety_harassment").value = c.safety?.harassment || "BLOCK_ONLY_HIGH";
  $("safety_sexual").value = c.safety?.sexual || "BLOCK_ONLY_HIGH";
  $("safety_dangerous").value = c.safety?.dangerous || "BLOCK_ONLY_HIGH";

  $("prompt").value = data.prompt || "";
  $("flow").value = data.flow || "";

  $("chatTitleInput").value = p.chatTitle || "";
  $("welcomeMessage").value = p.welcomeMessage || "";
}

async function saveConfig() {
  const token = $("adminToken").value.trim();

  const payload = {
    config: {
      provider: $("provider").value,
      model: $("model").value.trim(),
      temperature: Number($("temperature").value),
      top_p: Number($("top_p").value),
      max_tokens: Number($("max_tokens").value),
      frequency_penalty: Number($("frequency_penalty").value),
      presence_penalty: Number($("presence_penalty").value),
      safety: {
        hate: $("safety_hate").value,
        harassment: $("safety_harassment").value,
        sexual: $("safety_sexual").value,
        dangerous: $("safety_dangerous").value
      }
    },
    prompt: $("prompt").value,
    flow: $("flow").value,
    public: {
      chatTitle: $("chatTitleInput").value,
      welcomeMessage: $("welcomeMessage").value
    },
    secrets: {
      openai: { api_key: $("openai_key").value.trim() },
      gemini: { api_key: $("gemini_key").value.trim() }
    }
  };

  const response = await fetch("/api/admin/config", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-admin-token": token
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  $("status").textContent = JSON.stringify(data, null, 2);
}