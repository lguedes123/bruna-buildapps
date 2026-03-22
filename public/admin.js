

function showStatus(message, type = "success") {
  const el = document.getElementById("statusMessage");
  el.textContent = message;
  el.className = `status-message ${type}`;
  setTimeout(() => { el.className = "status-message"; }, 3500);
}

async function loadAvailableModels() {
  try {
    const res = await fetch(`${API_BASE}/admin/models`, { credentials: "include" });
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

    const res = await fetch(`${API_BASE}/admin/config`, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login.html";
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const pub  = data.public || {};

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };

    set("model",               data.config?.model || "gpt-4o-mini");
    set("prompt",              data.prompt);
    set("flow",                data.flow);
    set("chatTitle",           pub.chatTitle);
    set("chatDescription",     pub.chatDescription);
    set("welcomeMessage",      pub.welcomeMessage);
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
    const mRes = await fetch(`${API_BASE}/admin/models`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model })
    });
    if (!mRes.ok) { const e = await mRes.json(); throw new Error(e.error || "Erro ao salvar modelo"); }

    // Salva config geral
    const cRes = await fetch(`${API_BASE}/admin/config`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { model }, prompt, flow, public: publicData, moderation_message, summary_initial, summary_update, openai_api_key })
    });
    if (!cRes.ok) { const e = await cRes.json(); throw new Error(e.error || "Erro ao salvar config"); }

    showStatus("Configuracoes salvas com sucesso!");
  } catch (error) {
    showStatus(`Erro: ${error.message}`, "error");
  }
}

function handleLogout() {
  document.cookie = "admin_session=; path=/; max-age=0";
  window.location.href = "/index.html";
}

const API_BASE = "/api";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminForm");
  if (form) form.addEventListener("submit", saveConfiguration);
  loadConfiguration();
});
