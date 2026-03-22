const chatBox = document.getElementById("chatBox");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const chatTitle = document.getElementById("chatTitle");

const messages = [];

boot();

async function boot() {
  try {
    const response = await fetch("/api/admin/config", {
      headers: { "x-admin-token": "buildapps-admin-2026" }
    });
    const data = await response.json();
    if (data?.public?.chatTitle) chatTitle.textContent = data.public.chatTitle;
    if (data?.public?.welcomeMessage) {
      push("assistant", data.public.welcomeMessage);
    }
  } catch {
    push("assistant", "Olá. Como posso ajudar?");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  push("user", text);
  input.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ messages })
  });

  const data = await response.json();

  if (!response.ok) {
    push("assistant", data?.error || "Erro ao consultar a IA.");
    return;
  }

  push("assistant", data.output || "");
});

function push(role, content) {
  messages.push({ role, content });

  const item = document.createElement("div");
  item.className = `msg ${role}`;
  item.textContent = content;
  chatBox.appendChild(item);
  chatBox.scrollTop = chatBox.scrollHeight;
}