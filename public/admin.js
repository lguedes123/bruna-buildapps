const API_BASE = "/api";

function showStatus(message, type = "success") {
  const statusEl = document.getElementById("statusMessage");
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  setTimeout(() => {
    statusEl.className = "status-message";
  }, 3000);
}

async function loadConfiguration() {
  try {
    const res = await fetch(`${API_BASE}/admin/config`, {
      credentials: "include"
    });

    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = "/admin.html?login=1";
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const { config, prompt, flow, public: publicData } = await res.json();

    document.getElementById("model").value = config.model || "gpt-4o-mini";
    document.getElementById("prompt").value = prompt || "";
    document.getElementById("flow").value = flow || "";
    document.getElementById("public").value = JSON.stringify(publicData, null, 2) || "";
  } catch (error) {
    showStatus(`Erro ao carregar: ${error.message}`, "error");
  }
}

async function saveConfiguration(e) {
  e.preventDefault();

  const model = document.getElementById("model").value;
  const prompt = document.getElementById("prompt").value;
  const flow = document.getElementById("flow").value;
  const publicData = document.getElementById("public").value;

  try {
    if (!model) {
      throw new Error("Selecione um modelo");
    }

    // Primeiro, salva o modelo via endpoints separados
    await saveModel(model);
    
    // Depois, salva o config geral
    await saveConfig({ prompt, flow, publicData });

    showStatus("✓ Configurações salvas com sucesso!");
  } catch (error) {
    showStatus(`✗ Erro: ${error.message}`, "error");
  }
}

async function saveModel(model) {
  const res = await fetch(`${API_BASE}/admin/models`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao salvar modelo");
  }
}

async function saveConfig(data) {
  const res = await fetch(`${API_BASE}/admin/config`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        provider: "openai",
        model: document.getElementById("model").value,
        updated_at: new Date().toISOString()
      },
      prompt: data.prompt,
      flow: data.flow,
      public: data.publicData ? JSON.parse(data.publicData) : {}
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao salvar configurações");
  }
}

function handleLogout() {
  document.cookie = "admin_session=; path=/; max-age=0";
  window.location.href = "/index.html";
}

// Carregar configurações ao abrir a página
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminForm");
  if (form) {
    form.addEventListener("submit", saveConfiguration);
  }
  loadConfiguration();
});