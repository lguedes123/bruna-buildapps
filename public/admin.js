

function showStatus(message, type = "success") {
  const el = document.getElementById("statusMessage");
  el.textContent = message;
  el.className = `status-message ${type}`;
  setTimeout(() => { el.className = "status-message"; }, 3500);
}

async function loadAvailableModels() {
  try {
    const res = await fetch("/api/admin/models", { credentials: "include" });
    if (!res.ok) return;
    const { available_models } = await res.json();
    const sel = document.getElementById("model");
    sel.innerHTML = "";
    available_models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} - ${m.description}`;
      if (m.default) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

async function loadConfiguration() {
  try {
    await loadAvailableModels();

    const res = await fetch("/api/admin/config", { credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login.html";
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const pub  = data.public || {};

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };

    set("model",               data.config?.model || "gpt-4o-mini");
    set("temperature",         data.config?.temperature ?? "0.7");
    set("top_p",               data.config?.top_p ?? "1");
    set("max_tokens",          data.config?.max_tokens ?? "2048");
    set("frequency_penalty",   data.config?.frequency_penalty ?? "0");
    set("presence_penalty",    data.config?.presence_penalty ?? "0");
    document.getElementById("safety_filter").checked = !!data.config?.safety_filter;
    set("prompt",              data.prompt);
    set("flow",                data.flow);
    set("chatTitle",           pub.chatTitle);
    set("chatDescription",     pub.chatDescription);
    set("welcomeMessage",      data.welcomeMessage);
    set("moderation_message",  data.moderation_message);
    set("summary_initial",     data.summary_initial);
    set("summary_update",      data.summary_update);
    set("openai_api_key",      data.openai_api_key);

  } catch (error) {
    showStatus(`Erro ao carregar: ${error.message}`, "error");
  }
}

async function saveConfiguration(e) {
  e.preventDefault();

  const g = id => document.getElementById(id)?.value ?? "";

  const model           = g("model");
  const prompt          = g("prompt");
  const flow            = g("flow");
  const moderation_message = g("moderation_message");
  const summary_initial = g("summary_initial");
  const summary_update  = g("summary_update");
  const openai_api_key  = g("openai_api_key");

  const publicData = {
    chatTitle:       g("chatTitle"),
    chatDescription: g("chatDescription"),
    welcomeMessage:  g("welcomeMessage")
  };

  if (!model) { showStatus("Selecione um modelo.", "error"); return; }

  try {
    // Salva modelo
    const mRes = await fetch("/api/admin/models", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model })
    });
  const config = {
    model: document.getElementById("model").value,
    temperature: parseFloat(document.getElementById("temperature").value) || 0.7,
    top_p: parseFloat(document.getElementById("top_p").value) || 1,
    max_tokens: parseInt(document.getElementById("max_tokens").value) || 2048,
    frequency_penalty: parseFloat(document.getElementById("frequency_penalty").value) || 0,
    presence_penalty: parseFloat(document.getElementById("presence_penalty").value) || 0,
    safety_filter: document.getElementById("safety_filter").checked
  };
}

function handleLogout() {
  document.cookie = "admin_session=; path=/; max-age=0";
  window.location.href = "/index.html";
}



document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminForm");
  if (form) form.addEventListener("submit", saveConfiguration);
  loadConfiguration();
});
