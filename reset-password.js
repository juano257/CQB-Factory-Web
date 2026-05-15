const refs = {
  form: document.getElementById("reset-password-form"),
  newPassword: document.getElementById("new-password"),
  confirmPassword: document.getElementById("confirm-password"),
  message: document.getElementById("reset-password-message"),
};

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("token") || "").trim();
}

function showMessage(text, isError = false) {
  refs.message.textContent = text;
  refs.message.style.color = isError ? "#9b1d1d" : "#2f4b1f";
}

async function resetPassword(token, newPassword) {
  const response = await fetch("/api/auth/password/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, newPassword }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "No fue posible restablecer la contrasena.");
  }

  return payload;
}

async function init() {
  const token = getTokenFromUrl();
  if (!token) {
    showMessage("El enlace de recuperacion no es valido.", true);
    return;
  }

  refs.form.classList.remove("hidden");

  refs.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = String(refs.newPassword.value || "").trim();
    const confirmPassword = String(refs.confirmPassword.value || "").trim();

    if (!newPassword || !confirmPassword) {
      showMessage("Completa ambos campos.", true);
      return;
    }

    if (newPassword.length < 6) {
      showMessage("La contrasena debe tener al menos 6 caracteres.", true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Las contrasenas no coinciden.", true);
      return;
    }

    try {
      await resetPassword(token, newPassword);
      showMessage("Contrasena actualizada. Seras redirigido al login.");
      refs.form.reset();
      refs.form.classList.add("hidden");
      window.setTimeout(() => {
        window.location.href = "/?tab=partidas";
      }, 1200);
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

init();
