const STORAGE_TOKEN = "cqb_token";

const state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  eventId: "",
  team: "rojo",
  event: null,
  paymentToken: null,
  paymentPrepared: false,
};

const refs = {
  summaryBlock: document.getElementById("event-summary"),
  summaryTitle: document.getElementById("summary-title"),
  summaryDate: document.getElementById("summary-date"),
  summaryTeam: document.getElementById("summary-team"),
  summaryPrice: document.getElementById("summary-price"),
  paymentAlert: document.getElementById("payment-alert"),
  paymentForm: document.getElementById("payment-form"),
  paymentMessage: document.getElementById("payment-message"),
  startExternalPayButton: document.getElementById("start-external-pay-btn"),
  confirmPayButton: document.getElementById("confirm-pay-btn"),
};

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTeamLabel(team) {
  return team === "azul" ? "Equipo Azul" : "Equipo Rojo";
}

function setMessage(text, isError = false) {
  refs.paymentMessage.textContent = text;
  refs.paymentMessage.style.color = isError ? "#f2c8bb" : "#d4edc4";
}

function setAlert(text, isError = false) {
  refs.paymentAlert.classList.remove("hidden");
  refs.paymentAlert.classList.toggle("error", isError);
  refs.paymentAlert.textContent = text;
}

function clearAlert() {
  refs.paymentAlert.classList.add("hidden");
  refs.paymentAlert.classList.remove("error");
  refs.paymentAlert.textContent = "";
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message || "No fue posible completar la solicitud.";
    throw new Error(message);
  }

  return payload;
}

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  state.eventId = String(params.get("eventId") || "").trim();
  const team = String(params.get("team") || "rojo").trim().toLowerCase();
  state.team = ["rojo", "azul"].includes(team) ? team : "rojo";
}

async function loadEvent() {
  const data = await apiRequest("/api/events");
  const event = (data.events || []).find((item) => item.id === state.eventId);

  if (!event) {
    throw new Error("No encontramos la partida seleccionada.");
  }

  if (!event.canInscribe) {
    throw new Error(event.inscriptionMessage || "La inscripcion no esta disponible para esta partida.");
  }

  state.event = event;
  refs.summaryTitle.textContent = event.title;
  refs.summaryDate.textContent = formatDate(event.date);
  refs.summaryTeam.textContent = getTeamLabel(state.team);
  refs.summaryPrice.textContent = event.price;
  refs.summaryBlock.classList.remove("hidden");
}

async function prepareExternalPayment() {
  const prepare = await apiRequest("/api/payments/prepare", {
    method: "POST",
    body: JSON.stringify({ eventId: state.eventId, team: state.team }),
  });

  state.paymentToken = prepare.paymentToken;
  state.paymentPrepared = true;
}

async function confirmPaymentAndReserve() {
  if (!state.paymentToken) {
    throw new Error("Primero debes iniciar el pago externo.");
  }

  await apiRequest("/api/payments/confirm", {
    method: "POST",
    body: JSON.stringify({ paymentToken: state.paymentToken }),
  });

  return apiRequest(`/api/events/${state.eventId}/reserve`, {
    method: "POST",
    body: JSON.stringify({ team: state.team, paymentToken: state.paymentToken }),
  });
}

function disableForm(disabled) {
  refs.startExternalPayButton.disabled = disabled;
  refs.confirmPayButton.disabled = disabled || !state.paymentPrepared;
  refs.startExternalPayButton.textContent = disabled
    ? "Conectando con pasarela..."
    : "Iniciar pago externo";
  refs.confirmPayButton.textContent = disabled
    ? "Confirmando pago..."
    : "Ya pague, confirmar inscripcion";
}

function setupEvents() {
  refs.startExternalPayButton.addEventListener("click", async () => {
    clearAlert();
    setMessage("");

    try {
      disableForm(true);
      await prepareExternalPayment();
      disableForm(false);
      setAlert("Pago externo iniciado. Cuando vuelvas desde la pasarela, confirma tu inscripcion.");
      setMessage("Paso 1 completado: pago externo iniciado.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No fue posible iniciar el pago externo.";
      setMessage(errorMessage, true);
      setAlert(errorMessage, true);
      disableForm(false);
    }
  });

  refs.paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    setMessage("");

    try {
      if (!state.paymentPrepared) {
        throw new Error("Debes iniciar el pago externo antes de confirmar la inscripcion.");
      }

      disableForm(true);
      const data = await confirmPaymentAndReserve();
      setMessage(`Pago aprobado. Reserva confirmada para ${data.reservation.eventTitle}.`);
      setAlert("Inscripcion completada con exito. Seras redirigido a Partidas.");
      window.setTimeout(() => {
        window.location.href = "/?tab=partidas";
      }, 1200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No fue posible completar tu pago.";
      setMessage(errorMessage, true);
      setAlert(errorMessage, true);
      disableForm(false);
      return;
    }

    disableForm(false);
  });
}

async function init() {
  parseQueryParams();

  if (!state.token) {
    setAlert("Debes iniciar sesion para continuar con la inscripcion.", true);
    refs.paymentForm.classList.add("hidden");
    return;
  }

  if (!state.eventId) {
    setAlert("No se encontro la partida a inscribir. Vuelve al calendario e intentalo de nuevo.", true);
    refs.paymentForm.classList.add("hidden");
    return;
  }

  try {
    const me = await apiRequest("/api/me");
    if (!me.user?.emailVerified) {
      throw new Error("Debes verificar tu correo antes de continuar con la inscripcion.");
    }
    await loadEvent();
    setupEvents();
    disableForm(false);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "No fue posible cargar la inscripcion.";
    setAlert(errorMessage, true);
    refs.paymentForm.classList.add("hidden");
  }
}

init();
