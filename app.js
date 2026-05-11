const STORAGE_USERS = "cqb_users";
const STORAGE_SESSION = "cqb_session";

const events = [
  {
    id: "evt-1",
    title: "Operacion Tactica Nocturna",
    date: "2026-05-22T20:00:00",
    level: "Intermedio",
    price: "$14",
    slots: 40,
  },
  {
    id: "evt-2",
    title: "CQB Sabado | Turno Manana",
    date: "2026-05-23T10:30:00",
    level: "Principiante",
    price: "$10",
    slots: 40,
  },
  {
    id: "evt-3",
    title: "CQB Sabado | Turno Tarde",
    date: "2026-05-23T17:00:00",
    level: "Intermedio",
    price: "$12",
    slots: 40,
  },
  {
    id: "evt-4",
    title: "CQB Domingo | Turno Manana",
    date: "2026-05-24T11:00:00",
    level: "Principiante",
    price: "$10",
    slots: 40,
  },
  {
    id: "evt-5",
    title: "Liga Squad Domingo | Turno Tarde",
    date: "2026-05-24T16:30:00",
    level: "Avanzado",
    price: "$18",
    slots: 40,
  },
];

const state = {
  currentUser: null,
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

function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_USERS) || "{}");
}

function setUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getCurrentSessionEmail() {
  return localStorage.getItem(STORAGE_SESSION);
}

function saveSession(email) {
  localStorage.setItem(STORAGE_SESSION, email);
}

function clearSession() {
  localStorage.removeItem(STORAGE_SESSION);
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

function readCurrentUser() {
  const email = getCurrentSessionEmail();
  if (!email) return null;

  const users = getUsers();
  return users[email] || null;
}

function writeCurrentUser(nextUser) {
  const users = getUsers();
  users[nextUser.email] = nextUser;
  setUsers(users);
  state.currentUser = nextUser;
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

function getEventById(eventId) {
  return events.find((event) => event.id === eventId) || null;
}

function getAllReservationsByEvent(eventId) {
  const users = getUsers();
  return Object.values(users)
    .flatMap((user) => user.reservations || [])
    .filter((reservation) => reservation.eventId === eventId && reservation.status === "upcoming");
}

function getRemainingSlots(event) {
  return Math.max(0, event.slots - getAllReservationsByEvent(event.id).length);
}

function getEventsInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  }).length;
}

function renderHeroMetrics() {
  if (!refs.eventsMonthValue || !refs.eventsMonthLabel) return;

  const now = new Date();
  const eventsInMonth = getEventsInMonth(now);

  refs.eventsMonthValue.textContent = String(eventsInMonth);
  refs.eventsMonthLabel.textContent = "Eventos este mes";
}

function renderEvents() {
  const currentUser = state.currentUser;

  refs.eventsGrid.innerHTML = events
    .map((event) => {
      const remaining = getRemainingSlots(event);
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
  const lossRate = toPercent(losses, played);

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

function showMessage(text, isError = false) {
  refs.authMessage.textContent = text;
  refs.authMessage.style.color = isError ? "#9b1d1d" : "#2f4b1f";
}

function registerUser(formData) {
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!name || !email || !password) {
    showMessage("Completa todos los campos para continuar.", true);
    return;
  }

  const users = getUsers();
  if (users[email]) {
    showMessage("Este correo ya tiene una cuenta.", true);
    return;
  }

  const user = {
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    reservations: [],
  };

  users[email] = user;
  setUsers(users);
  saveSession(email);
  state.currentUser = user;

  refs.registerForm.reset();
  showMessage("Cuenta creada con exito. Ya puedes inscribirte.");
  render();
}

function loginUser(formData) {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  const users = getUsers();
  const user = users[email];

  if (!user || user.password !== password) {
    showMessage("Correo o contrasena incorrectos.", true);
    return;
  }

  saveSession(email);
  state.currentUser = user;
  refs.loginForm.reset();
  showMessage("Sesion iniciada. Revisa tus partidas en el panel.");
  render();
}

function logoutUser() {
  clearSession();
  state.currentUser = null;
  showMessage("Sesion cerrada.");
  render();
}

function joinEvent(eventId) {
  const user = state.currentUser;
  if (!user) {
    showMessage("Debes iniciar sesion para inscribirte.", true);
    return;
  }

  const event = getEventById(eventId);
  if (!event) return;

  if (getRemainingSlots(event) <= 0) {
    showMessage("Lo sentimos, esta partida se lleno.", true);
    renderEvents();
    return;
  }

  const alreadyJoined = user.reservations?.some(
    (reservation) => reservation.eventId === event.id && reservation.status === "upcoming"
  );

  if (alreadyJoined) {
    showMessage("Ya estas inscrito en esta partida.", true);
    return;
  }

  const nextReservation = {
    id: `${event.id}-${Date.now()}`,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date,
    status: "upcoming",
    createdAt: new Date().toISOString(),
  };

  const nextUser = {
    ...user,
    reservations: [...(user.reservations || []), nextReservation],
  };

  writeCurrentUser(nextUser);
  showMessage(`Reserva confirmada para ${event.title}.`);
  render();
}

function registerMatchResult(reservationId, result) {
  const user = state.currentUser;
  if (!user) return;

  const targetReservation = (user.reservations || []).find((reservation) => reservation.id === reservationId);
  if (!targetReservation || targetReservation.status !== "upcoming") return;

  const reservations = (user.reservations || []).map((reservation) => {
    if (reservation.id !== reservationId) return reservation;
    return { ...reservation, status: "played", result };
  });

  const wasWin = result === "win";

  const nextUser = {
    ...user,
    reservations,
    matchesPlayed: (user.matchesPlayed || 0) + 1,
    wins: (user.wins || 0) + (wasWin ? 1 : 0),
    losses: (user.losses || 0) + (wasWin ? 0 : 1),
  };

  writeCurrentUser(nextUser);
  showMessage(wasWin ? "Resultado registrado: victoria." : "Resultado registrado: derrota.");
  render();
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

function setupEvents() {
  refs.pageTabs.forEach((button) => {
    button.addEventListener("click", () => switchPageTab(button.dataset.pageTab));
  });

  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchAuthTab(button.dataset.tab));
  });

  refs.registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    registerUser(new FormData(refs.registerForm));
  });

  refs.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginUser(new FormData(refs.loginForm));
  });

  refs.logoutBtn.addEventListener("click", logoutUser);

  refs.eventsGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const eventId = target.dataset.eventId;
    if (!eventId || target.disabled) return;

    joinEvent(eventId);
  });

  refs.reservationsList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const reservationId = target.dataset.reservationId;
    const result = target.dataset.result;
    if (!reservationId) return;
    if (result !== "win" && result !== "loss") return;

    registerMatchResult(reservationId, result);
  });

  // Send users to the account section with the right tab selected.
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

function init() {
  state.currentUser = readCurrentUser();
  switchPageTab("inicio");
  setupEvents();
  render();
}

init();
