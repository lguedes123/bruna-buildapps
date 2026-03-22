const API = "/api/admin";
let currentPage = 1;
let totalPages  = 1;
let searchTerm  = "";
let searchTimer = null;
let activeId    = null;

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm  = document.getElementById("searchInput").value;
    currentPage = 1;
    loadList();
  }, 350);
}

async function loadList() {
  const list = document.getElementById("histList");
  list.innerHTML = '<div class="hist-empty">Carregando...</div>';

  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    if (searchTerm) params.set("search", searchTerm);

    const res = await fetch(`${API}/conversations?${params}`, { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login.html"; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { conversations, total, limit } = await res.json();
    totalPages = Math.max(1, Math.ceil(total / limit));

    renderList(conversations);
    renderPagination();
  } catch (err) {
    list.innerHTML = `<div class="hist-empty">Erro: ${err.message}</div>`;
  }
}

function renderList(items) {
  const list = document.getElementById("histList");
  if (!items.length) {
    list.innerHTML = '<div class="hist-empty">Nenhuma conversa encontrada.</div>';
    return;
  }
  list.innerHTML = items.map(c => {
    const name    = c.user_name || "Paciente desconhecido";
    const date    = new Date(c.updated_at).toLocaleString("pt-BR");
    const preview = c.summary ? c.summary.slice(0, 80) + "..." : `${c.message_count} mensagens`;
    const active  = c.id === activeId ? " active" : "";
    return `<div class="hist-item${active}" onclick="openConversation(${c.id})" data-id="${c.id}">
      <div class="name">${escHtml(name)}</div>
      <div class="meta">${date} &bull; ${c.message_count} msgs</div>
      <div class="preview">${escHtml(preview)}</div>
    </div>`;
  }).join("");
}

function renderPagination() {
  const el = document.getElementById("pagination");
  el.innerHTML = `
    <button onclick="changePage(-1)" ${currentPage <= 1 ? "disabled" : ""}>&#8592; Anterior</button>
    <span style="font-size:12px;align-self:center;">${currentPage} / ${totalPages}</span>
    <button onclick="changePage(1)"  ${currentPage >= totalPages ? "disabled" : ""}>Proxima &#8594;</button>
  `;
}

function changePage(dir) {
  currentPage = Math.min(totalPages, Math.max(1, currentPage + dir));
  loadList();
}

async function openConversation(id) {
  activeId = id;
  // Update active highlight
  document.querySelectorAll(".hist-item").forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.id) === id);
  });

  const main = document.getElementById("histMain");
  main.innerHTML = '<div class="hist-placeholder"><span>Carregando...</span></div>';

  try {
    const res = await fetch(`${API}/conversation?id=${id}`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { conversation: conv, messages } = await res.json();

    const name    = conv.user_name || "Paciente desconhecido";
    const started = new Date(conv.started_at).toLocaleString("pt-BR");
    const updated = new Date(conv.updated_at).toLocaleString("pt-BR");

    const summaryHtml = conv.summary
      ? `<div class="conv-summary"><h3>Resumo Clinico</h3><pre>${escHtml(conv.summary)}</pre></div>`
      : "";

    const msgsHtml = messages.map(m => {
      const ts = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `<div class="conv-msg ${m.role}">${escHtml(m.content)}<div class="ts">${ts}</div></div>`;
    }).join("");

    main.innerHTML = `
      <div class="conv-header">
        <div>
          <h2>${escHtml(name)}</h2>
          <div class="conv-meta">Iniciada: ${started} &bull; Ultima msg: ${updated} &bull; ${messages.length} mensagens</div>
        </div>
        <button class="btn-del" onclick="deleteConversation(${id})">Excluir</button>
      </div>
      ${summaryHtml}
      <div class="conv-messages">${msgsHtml}</div>
    `;
  } catch (err) {
    main.innerHTML = `<div class="hist-placeholder"><span>Erro: ${err.message}</span></div>`;
  }
}

async function deleteConversation(id) {
  if (!confirm("Excluir esta conversa permanentemente?")) return;
  try {
    const res = await fetch(`${API}/conversations?id=${id}`, {
      method: "DELETE", credentials: "include"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById("histMain").innerHTML =
      '<div class="hist-placeholder"><span style="font-size:32px;">&#128172;</span><span>Conversa excluida.</span></div>';
    activeId = null;
    loadList();
  } catch (err) {
    alert(`Erro ao excluir: ${err.message}`);
  }
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", loadList);
