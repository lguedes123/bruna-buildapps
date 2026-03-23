// Função para remover marcações markdown básicas (###, **, __, *, _, etc)
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/[#*_`~>-]+/g, '') // remove #, *, _, `, ~, >, -
    .replace(/\n{2,}/g, '\n') // remove quebras de linha duplas
    .replace(/\s{2,}/g, ' ')   // espaços duplos
    .trim();
}

// Adiciona botão de download do relatório TXT se houver summary carregado
async function addDownloadButton(summary, userName) {
  const area = document.getElementById('downloadArea');
  area.innerHTML = '';
  if (!summary) return;
  const btn = document.createElement('button');
  btn.textContent = 'Baixar relatório TXT';
  btn.className = 'btn-secondary';
  btn.style.marginBottom = '10px';
  btn.onclick = function() {
    const clean = stripMarkdown(summary);
    const blob = new Blob([clean], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${(userName||'conversa').replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); }, 100);
  };
  area.appendChild(btn);
}


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
    await fetch("/api/admin/models", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model })
    });

    // Monta config com todos os parâmetros avançados
    const config = {
      model,
      temperature: parseFloat(g("temperature")) || 0.7,
      top_p: parseFloat(g("top_p")) || 1,
      max_tokens: parseInt(g("max_tokens")) || 2048,
      frequency_penalty: parseFloat(g("frequency_penalty")) || 0,
      presence_penalty: parseFloat(g("presence_penalty")) || 0,
      safety_filter: document.getElementById("safety_filter").checked
    };

    // Envia para o backend
    const res = await fetch("/api/admin/config", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config,
        prompt,
        flow,
        public: publicData,
        moderation_message,
        summary_initial,
        summary_update,
        openai_api_key
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showStatus("Configurações salvas com sucesso.", "success");
  } catch (error) {
    showStatus(`Erro ao salvar: ${error.message}`, "error");
  }
}

function handleLogout() {
  document.cookie = "admin_session=; path=/; max-age=0";
  window.location.href = "/index.html";
}



document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminForm");
  if (form) form.addEventListener("submit", saveConfiguration);
  loadConfiguration();

  // Se estivermos na página de conversa específica, tenta buscar o summary e mostrar botão
  const url = new URL(window.location.href);
  const convId = url.searchParams.get('id');
  if (convId) {
    fetch(`/api/admin/conversation?id=${convId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.conversation?.summary) {
          addDownloadButton(data.conversation.summary, data.conversation.user_name);
        }
      });
  }
});
