const STORAGE_TOKEN = "cqb_token";

const state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  currentUser: null,
  events: [],
};

const refs = {
  eventsGrid: document.getElementById("events-grid"),
  eventsMonthValue: document.getElementById("events-month-value"),
  eventsMonthLabel: document.getElementById("events-month-label"),
  authGuestView: document.getElementById("auth-guest-view"),
  authUserView: document.getElementById("auth-user-view"),
  registerForm: document.getElementById("register-form"),
  loginForm: document.getElementById("login-form"),
  authMessage: document.getElementById("auth-message"),
  welcomeText: document.getElementById("welcome-text"),
  logoutBtn: document.getElementById("logout-btn"),
  reservationsList: document.getElementById("reservations-list"),
  statPlayed: document.getElementById("stat-played"),
  statUpcoming: document.getElementById("stat-upcoming"),
  statWins: document.getElementById("stat-wins"),
  statLosses: document.getElementById("stat-losses"),
  statRatio: document.getElementById("stat-ratio"),
  statBadge: document.getElementById("stat-badge"),
  nextMatchText: document.getElementById("next-match-text"),
  tabButtons: Array.from(document.querySelectorAll(".tab")),
  headerCta: document.getElementById("header-cta"),
  heroRegister: document.getElementById("hero-register"),
  heroLogin: document.getElementById("hero-login"),
  pageTabs: Array.from(document.querySelectorAll(".top-tab")),
  tabInicio: document.getElementById("tab-inicio"),
  tabPartidas: document.getElementById("tab-partidas"),
  tabContacto: document.getElementById("tab-contacto"),
};

const pagePanels = {
  inicio: refs.tabInicio,
  partidas: refs.tabPartidas,
  contacto: refs.tabContacto,
};

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
    const message = payload.message || "Error inesperado en la solicitud";
    throw new Error(message);
  }

  return payload;
}

function saveToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(STORAGE_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN);
  }
}

function getBadge(matchesPlayed, winRate) {
  if (matchesPlayed < 5) return "Recluta";
  if (winRate >= 70) return "Comando Elite";
  if (winRate >= 55) return "Operador";
  if (winRate >= 40) return "Fusilero";
  return "Cadete";
}

function toPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function getWinLossRatio(wins, losses) {
  if (wins === 0 && losses === 0) return "0.00";
  if (losses === 0) return `${wins.toFixed(2)}`;
  return (wins / losses).toFixed(2);
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventsInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return state.events.filter((event) => {
    const eventDate = new Date(event.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  }).length;
}

function showMessage(text, isError = false) {
  refs.authMessage.textContent = text;
  refs.authMessage.style.color = isError ? "#9b1d1d" : "#2f4b1f";
}

function renderHeroMetrics() {
  const now = new Date();
  refs.eventsMonthValue.textContent = String(getEventsInMonth(now));
  refs.eventsMonthLabel.textContent = "Eventos este mes";
}

function renderAuthView() {
  const user = state.currentUser;
  if (!user) {
    refs.authGuestView.classList.remove("hidden");
    refs.authUserView.classList.add("hidden");
    refs.welcomeText.textContent = "";
    return;
  }

  refs.authGuestView.classList.add("hidden");
  refs.authUserView.classList.remove("hidden");
  refs.welcomeText.textContent = `Bienvenido, ${user.name}.`;
}

function renderDashboard() {
  const user = state.currentUser;

  if (!user) {
    refs.statPlayed.textContent = "0";
    refs.statUpcoming.textContent = "0";
    refs.statWins.textContent = "0";
    refs.statLosses.textContent = "0";
    refs.statRatio.textContent = "0.00";
    refs.statBadge.textContent = "Recluta";
    refs.nextMatchText.textContent = "Inicia sesion para ver tu agenda.";
    refs.reservationsList.innerHTML = "<li class='reservation-item'>Sin actividad aun.</li>";
    return;
  }

  const reservations = user.reservations || [];
  const upcoming = reservations.filter((reservation) => reservation.status === "upcoming");
  const played = user.matchesPlayed || 0;
  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const winRate = toPercent(wins, played);

  refs.statPlayed.textContent = String(played);
  refs.statUpcoming.textContent = String(upcoming.length);
  refs.statWins.textContent = String(wins);
  refs.statLosses.textContent = String(losses);
  refs.statRatio.textContent = getWinLossRatio(wins, losses);
  refs.statBadge.textContent = getBadge(played, winRate);

  if (upcoming.length > 0) {
    const nearest = [...upcoming]
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
    refs.nextMatchText.textContent = `${nearest.eventTitle} | ${formatDate(nearest.eventDate)}`;
  } else {
    refs.nextMatchText.textContent = "No tienes reservas activas.";
  }

  const rows = reservations
    .slice()
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .map((reservation) => {
      const statusClass = reservation.status === "played" ? "status-played" : "status-upcoming";
      const statusText =
        reservation.status === "played"
          ? reservation.result === "win"
            ? "Victoria"
            : "Derrota"
          : "Reservada";

      const actionBtn =
        reservation.status === "upcoming"
          ? `<div class="reservation-actions">
              <button class="btn btn-result-win" data-reservation-id="${reservation.id}" data-result="win">Victoria</button>
              <button class="btn btn-result-loss" data-reservation-id="${reservation.id}" data-result="loss">Derrota</button>
            </div>`
          : "";

      return `
        <li class="reservation-item">
          <div class="reservation-details">
            <strong>${reservation.eventTitle}</strong>
            <span>${formatDate(reservation.eventDate)}</span>
            <span class="status-pill ${statusClass}">${statusText}</span>
          </div>
          ${actionBtn}
        </li>
      `;
    });

  refs.reservationsList.innerHTML = rows.length
    ? rows.join("")
    : "<li class='reservation-item'>Sin actividad aun.</li>";
}

function renderEvents() {
  const currentUser = state.currentUser;

  refs.eventsGrid.innerHTML = state.events
    .map((event) => {
      const remaining = event.availableSlots;
      const alreadyJoined =
        currentUser?.reservations?.some(
          (reservation) => reservation.eventId === event.id && reservation.status === "upcoming"
        ) || false;

      const disabled = !currentUser || remaining === 0 || alreadyJoined;

      let buttonLabel = "Inscribirme";
      if (!currentUser) buttonLabel = "Inicia sesion";
      if (alreadyJoined) buttonLabel = "Ya inscrito";
      if (remaining === 0) buttonLabel = "Cupos agotados";

      return `
        <article class="event-card">
          <div class="event-meta">
            <span>${formatDate(event.date)}</span>
            <span>${event.level}</span>
          </div>
          <div class="event-title">${event.title}</div>
          <div class="event-meta">
            <span>${event.price}</span>
            <span>${remaining}/${event.slots} cupos</span>
          </div>
          <button class="btn btn-primary" data-event-id="${event.id}" ${disabled ? "disabled" : ""}>
            ${buttonLabel}
          </button>
        </article>
      `;
    })
    .join("");
}

function switchAuthTab(tabName) {
  const isRegister = tabName === "register";
  refs.registerForm.classList.toggle("hidden", !isRegister);
  refs.loginForm.classList.toggle("hidden", isRegister);

  refs.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
}

function switchPageTab(tabName) {
  refs.pageTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTab === tabName);
  });

  Object.entries(pagePanels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.classList.toggle("hidden", key !== tabName);
  });
}

async function refreshEvents() {
  const data = await apiRequest("/api/events");
  state.events = data.events || [];
}

async function refreshCurrentUser() {
  if (!state.token) {
    state.currentUser = null;
    return;
  }

  try {
    const data = await apiRequest("/api/me");
    state.currentUser = data.user;
  } catch (_error) {
    saveToken(null);
    state.currentUser = null;
  }
}

async function registerUser(formData) {
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!name || !email || !password) {
    showMessage("Completa todos los campos para continuar.", true);
    return;
  }

  try {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    saveToken(data.token);
    state.currentUser = data.user;
    refs.registerForm.reset();
    showMessage("Cuenta creada con exito. Ya puedes inscribirte.");
    await refreshEvents();
    render();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loginUser(formData) {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    saveToken(data.token);
    state.currentUser = data.user;
    refs.loginForm.reset();
    showMessage("Sesion iniciada. Revisa tus partidas en el panel.");
    await refreshEvents();
    render();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function logoutUser() {
  try {
    if (state.token) {
      await apiRequest("/api/auth/logout", { method: "POST" });
    }
  } catch (_error) {
    // Ignore logout failures and clear local session anyway.
  }

  saveToken(null);
  state.currentUser = null;
  showMessage("Sesion cerrada.");
  await refreshEvents();
  render();
}

async function joinEvent(eventId) {
  if (!state.currentUser) {
    showMessage("Debes iniciar sesion para inscribirte.", true);
    return;
  }

  try {
    const data = await apiRequest(`/api/events/${eventId}/reserve`, { method: "POST" });
    state.currentUser = data.user;
    showMessage(`Reserva confirmada para ${data.reservation.eventTitle}.`);
    await refreshEvents();
    render();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function registerMatchResult(reservationId, result) {
  if (!state.currentUser) return;

  try {
    const data = await apiRequest(`/api/reservations/${reservationId}/result`, {
      method: "POST",
      body: JSON.stringify({ result }),
    });

    state.currentUser = data.user;
    showMessage(result === "win" ? "Resultado registrado: victoria." : "Resultado registrado: derrota.");
    await refreshEvents();
    render();
  } catch (error) {
    showMessage(error.message, true);
  }
}

function setupEvents() {
  refs.pageTabs.forEach((button) => {
    button.addEventListener("click", () => switchPageTab(button.dataset.pageTab));
  });

  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchAuthTab(button.dataset.tab));
  });

  refs.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await registerUser(new FormData(refs.registerForm));
  });

  refs.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loginUser(new FormData(refs.loginForm));
  });

  refs.logoutBtn.addEventListener("click", async () => {
    await logoutUser();
  });

  refs.eventsGrid.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const eventId = target.dataset.eventId;
    if (!eventId || target.disabled) return;

    await joinEvent(eventId);
  });

  refs.reservationsList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const reservationId = target.dataset.reservationId;
    const result = target.dataset.result;
    if (!reservationId) return;
    if (result !== "win" && result !== "loss") return;

    await registerMatchResult(reservationId, result);
  });

  refs.headerCta.addEventListener("click", () => {
    switchPageTab("partidas");
    switchAuthTab("register");
    document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
  });

  refs.heroRegister.addEventListener("click", () => {
    switchPageTab("partidas");
    switchAuthTab("register");
    document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
  });

  refs.heroLogin.addEventListener("click", () => {
    switchPageTab("partidas");
    switchAuthTab("login");
    document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
  });
}

function render() {
  renderHeroMetrics();
  renderAuthView();
  renderDashboard();
  renderEvents();
}

async function init() {
  switchPageTab("inicio");
  setupEvents();

  await refreshEvents();
  await refreshCurrentUser();

  render();
}

init();
