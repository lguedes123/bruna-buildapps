const chatMessages = document.getElementById("chatMessages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatTitle = document.getElementById("chatTitle");
const headerStatus = document.getElementById("headerStatus");


let userType = null;
const messages = [];
let isLoading = false;
let statusText = headerStatus.textContent;

// ID de sessao unico por visita
const SESSION_ID = (() => {
  let id = sessionStorage.getItem("chat_session_id");
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem("chat_session_id", id);
  }
  return id;
})();

// Auto-resize textarea
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
});

// Send on Enter (Shift+Enter = new line)
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

sendBtn.addEventListener("click", send);


// Exibe seleção de tipo de usuário no início
function showUserTypeSelection() {
  const selectionDiv = document.createElement("div");
  selectionDiv.className = "user-type-selection";
  selectionDiv.innerHTML = `
    <div class="user-type-title">Olá, vamos iniciar o processo de Anamnese Médica.<br>Por favor se identifique:</div>
    <div class="user-type-buttons">
      <button data-type="medico">Sou médico</button>
      <button data-type="paciente">Sou paciente</button>
      <button data-type="profissional">Sou profissional de saúde</button>
    </div>
  `;
  chatMessages.appendChild(selectionDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  selectionDiv.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      userType = btn.getAttribute("data-type");
      selectionDiv.remove();
      askName();
    };
  });
}

function askName() {
  let question = "";
  if (userType === "paciente") question = "Qual seu nome?";
  else question = "Qual o nome do paciente?";
  addMessage("assistant", question, true);
}

boot();


async function boot() {
  showUserTypeSelection();
}


async function send() {
  if (isLoading) return;
  const text = input.value.trim();
  if (!text) return;

  addMessage("user", text);
  messages.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";

  showTyping();
  setLoading(true);

  try {
    // Envia user_type apenas na primeira mensagem
    const isFirstMessage = messages.length === 1;
    const payload = { messages, session_id: SESSION_ID };
    if (isFirstMessage && userType) payload.user_type = userType;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    hideTyping();

    const reply = response.ok
      ? (data.output || "")
      : (data?.error || "Erro ao consultar a IA.");

    addMessage("assistant", reply);
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    hideTyping();
    addMessage("assistant", "Erro de conexão. Tente novamente.");
  } finally {
    setLoading(false);
  }
}

function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = state;
  headerStatus.textContent = state ? "digitando..." : statusText;
}

function addMessage(role, content, silent = false) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `${getTime()}${role === "user" ? ' <span class="checkmarks">✓✓</span>' : ''}`;

  bubble.appendChild(meta);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

let typingEl = null;
function showTyping() {
  typingEl = document.createElement("div");
  typingEl.className = "msg assistant typing-indicator";
  typingEl.innerHTML = `<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function getTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}