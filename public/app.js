const chatMessages = document.getElementById("chatMessages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatTitle = document.getElementById("chatTitle");
const headerStatus = document.getElementById("headerStatus");



let userType = null;
let cpf = null;
let profissionalCpf = null;
let userName = null;
let profissionalNome = null;
let cpfStep = 0; // 0: não iniciado, 1: aguardando cpf paciente, 2: aguardando cpf profissional
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
  if (userType === "paciente") {
    addMessage("assistant", "Qual seu nome?", true);
    cpfStep = 1;
  } else {
    addMessage("assistant", "Qual o nome do paciente?", true);
    cpfStep = 1;
  }
}

function askCpf() {
  addMessage("assistant", "Por favor, informe o CPF do paciente:", true);
  cpfStep = 1;
}

function askProfissionalCpf() {
  addMessage("assistant", "Por favor, informe o CPF do profissional de saúde:", true);
  cpfStep = 2;
}

function isValidCPF(strCPF) {
  strCPF = strCPF.replace(/\D/g, "");
  if (strCPF.length !== 11 || /^([0-9])\1+$/.test(strCPF)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  if (rest !== parseInt(strCPF.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(strCPF.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  if (rest !== parseInt(strCPF.substring(10, 11))) return false;
  return true;
}

boot();


async function boot() {
  showUserTypeSelection();
}



async function send() {
  if (isLoading) return;
  const text = input.value.trim();
  if (!text) return;

  // Fluxo de coleta de nome e CPF
  if (cpfStep === 1 && !userName) {
    userName = text;
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "auto";
    askCpf();
    return;
  }
  if (cpfStep === 1 && !cpf) {
    if (!isValidCPF(text)) {
      addMessage("assistant", "CPF inválido. Por favor, digite novamente:", true);
      input.value = "";
      return;
    }
    cpf = text.replace(/\D/g, "");
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "auto";
    if (userType === "paciente") {
      // Envia para backend para checar se já existe
      await checkCpfAndStart();
      return;
    } else {
      askProfissionalCpf();
      return;
    }
  }
  if (cpfStep === 2 && !profissionalCpf) {
    if (!isValidCPF(text)) {
      addMessage("assistant", "CPF do profissional inválido. Por favor, digite novamente:", true);
      input.value = "";
      return;
    }
    profissionalCpf = text.replace(/\D/g, "");
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "auto";
    // Envia para backend para checar se já existe
    await checkCpfAndStart();
    return;
  }

  addMessage("user", text);
  messages.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";

  showTyping();
  setLoading(true);

  try {
    // Envia user_type, cpf, profissional_cpf, user_name na primeira mensagem útil
    const isFirstMessage = messages.length === 1;
    const payload = { messages, session_id: SESSION_ID };
    if (isFirstMessage && userType) payload.user_type = userType;
    if (cpf) payload.cpf = cpf;
    if (profissionalCpf) payload.profissional_cpf = profissionalCpf;
    if (userName) payload.user_name = userName;

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

async function checkCpfAndStart() {
  // Checa se CPF já existe no backend e cumprimenta se sim
  try {
    const payload = { cpf, profissional_cpf: profissionalCpf, user_type: userType };
    const res = await fetch("/api/chat/check-cpf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.exists && data.nome) {
      addMessage("assistant", `Olá, ${data.nome}! Vamos iniciar a anamnese.`, true);
    } else {
      addMessage("assistant", "Vamos iniciar a anamnese.", true);
    }
    cpfStep = 0;
  } catch {
    addMessage("assistant", "Erro ao verificar CPF.", true);
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