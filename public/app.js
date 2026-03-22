const chatMessages = document.getElementById("chatMessages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatTitle = document.getElementById("chatTitle");
const headerStatus = document.getElementById("headerStatus");

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

boot();

async function boot() {
  try {
    const response = await fetch("/api/chat/public");
    if (response.ok) {
      const data = await response.json();
      if (data?.chatTitle) chatTitle.textContent = data.chatTitle;
      if (data?.chatDescription) { headerStatus.textContent = data.chatDescription; statusText = data.chatDescription; }
      if (data?.welcomeMessage) addMessage("assistant", data.welcomeMessage, true);
      return;
    }
  } catch {}
  addMessage("assistant", "Ola! Sou seu assistente de anamnese. Como posso ajudar?", true);
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
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, session_id: SESSION_ID })
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