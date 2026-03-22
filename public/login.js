const API_BASE = "/api";

function showStatus(message, type = "success") {
  const statusEl = document.getElementById("statusMessage");
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showStatus("Preencha usuário e senha", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Credenciais inválidas");
    }

    showStatus("✓ Login realizado! Redirecionando...", "success");
    setTimeout(() => {
      window.location.href = "/admin.html";
    }, 1000);
  } catch (error) {
    showStatus(`✗ ${error.message}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (form) {
    form.addEventListener("submit", handleLogin);
  }
});
