const STORAGE_TOKEN = "cqb_token";

const state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  currentUser: null,
  events: [],
  moderationReservations: [],
  currentSeason: null,
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
  moderatorPanel: document.getElementById("moderator-panel"),
  moderatorPendingCount: document.getElementById("moderator-pending-count"),
  moderatorPlayedCount: document.getElementById("moderator-played-count"),
  moderatorReservationsList: document.getElementById("moderator-reservations-list"),
  moderatorRefreshBtn: document.getElementById("moderator-refresh-btn"),
  seasonName: document.getElementById("season-name"),
  seasonStatus: document.getElementById("season-status"),
  seasonDates: document.getElementById("season-dates"),
  seasonEndBtn: document.getElementById("season-end-btn"),
  seasonStartBtn: document.getElementById("season-start-btn"),
  moderarTabButton: document.getElementById("moderate-tab-btn"),
  statPlayed: document.getElementById("stat-played"),
  statUpcoming: document.getElementById("stat-upcoming"),
  statWins: document.getElementById("stat-wins"),
  statLosses: document.getElementById("stat-losses"),
  statRatio: document.getElementById("stat-ratio"),
  statBadge: document.getElementById("stat-badge"),
  nextMatchText: document.getElementById("next-match-text"),
  tabButtons: Array.from(document.querySelectorAll(".tab")),
  headerCta: document.getElementById("header-cta"),
  headerPlayerName: document.getElementById("header-player-name"),
  heroRegister: document.getElementById("hero-register"),
  heroLogin: document.getElementById("hero-login"),
  pageTabs: Array.from(document.querySelectorAll(".top-tab")),
  tabInicio: document.getElementById("tab-inicio"),
  tabPartidas: document.getElementById("tab-partidas"),
  tabModerar: document.getElementById("tab-moderar"),
  tabContacto: document.getElementById("tab-contacto"),
};

const pagePanels = {
  inicio: refs.tabInicio,
  partidas: refs.tabPartidas,
  moderar: refs.tabModerar,
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

function formatDateLong(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("es-MX", {
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

function isStaffRole(role) {
  return role === "moderator" || role === "admin";
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
  const canModerate = isStaffRole(user?.role);

  refs.moderarTabButton.classList.toggle("hidden", !canModerate);
  if (!canModerate && refs.moderarTabButton.classList.contains("active")) {
    switchPageTab("inicio");
  }

  if (!user) {
    refs.authGuestView.classList.remove("hidden");
    refs.authUserView.classList.add("hidden");
    refs.welcomeText.textContent = "";
    refs.headerCta.classList.remove("hidden");
    refs.headerPlayerName.classList.add("hidden");
    refs.headerPlayerName.textContent = "";
    return;
  }

  refs.authGuestView.classList.add("hidden");
  refs.authUserView.classList.remove("hidden");
  refs.welcomeText.textContent = `Bienvenido, ${user.name}.`;
  refs.headerCta.classList.add("hidden");
  refs.headerPlayerName.classList.remove("hidden");
  refs.headerPlayerName.textContent = user.name;
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
          : "Pendiente de validacion";

      return `
        <li class="reservation-item">
          <div class="reservation-details">
            <strong>${reservation.eventTitle}</strong>
            <span>${formatDate(reservation.eventDate)}</span>
            <span class="team-pill team-${reservation.team || "rojo"}">${getTeamLabel(reservation.team)}</span>
            <span class="status-pill ${statusClass}">${statusText}</span>
          </div>
        </li>
      `;
    });

  refs.reservationsList.innerHTML = rows.length
    ? rows.join("")
    : "<li class='reservation-item'>Sin actividad aun.</li>";
}

function renderModeratorPanel() {
  const user = state.currentUser;
  const isModerator = isStaffRole(user?.role);

  refs.moderatorPanel.classList.toggle("hidden", !isModerator);
  if (!isModerator) {
    refs.moderatorPendingCount.textContent = "0";
    refs.moderatorPlayedCount.textContent = "0";
    refs.moderatorReservationsList.innerHTML = "";
    return;
  }

  const season = state.currentSeason;
  const isActiveSeason = season?.status === "active";
  refs.seasonName.textContent = season?.name || "Sin temporada activa";
  refs.seasonStatus.textContent = isActiveSeason ? "Activa" : "Cerrada";
  refs.seasonStatus.classList.toggle("status-upcoming", isActiveSeason);
  refs.seasonStatus.classList.toggle("status-played", !isActiveSeason);
  refs.seasonDates.textContent = season
    ? isActiveSeason
      ? `Inicio: ${formatDateLong(season.startedAt)}`
      : `Cerrada el ${formatDateLong(season.endedAt || season.startedAt)}`
    : "Inicia una temporada para habilitar estadisticas y cierres.";
  refs.seasonEndBtn.disabled = !isActiveSeason;
  refs.seasonStartBtn.disabled = isActiveSeason;

  const reservations = state.moderationReservations || [];
  const pending = reservations.filter((reservation) => reservation.status === "upcoming");
  const played = reservations.filter((reservation) => reservation.status === "played");

  const events = Array.from(
    reservations
      .reduce((map, reservation) => {
        const currentEvent = map.get(reservation.eventId) || {
          id: reservation.eventId,
          title: reservation.eventTitle,
          date: reservation.eventDate,
          reservations: [],
        };

        currentEvent.reservations.push(reservation);
        map.set(reservation.eventId, currentEvent);
        return map;
      }, new Map())
      .values()
  ).sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  refs.moderatorPendingCount.textContent = String(pending.length);
  refs.moderatorPlayedCount.textContent = String(played.length);

  refs.moderatorReservationsList.innerHTML = events.length
    ? events
        .map((event) => {
          const redTeam = event.reservations.filter((reservation) => reservation.team === "rojo");
          const blueTeam = event.reservations.filter((reservation) => reservation.team === "azul");
          const hasPending = event.reservations.some((reservation) => reservation.status === "upcoming");
          const winnerReservation = event.reservations.find((reservation) => reservation.result === "win");
          const winnerLabel = winnerReservation ? getTeamLabel(winnerReservation.team) : "Sin definir";

          return `
            <li class="moderation-event-card">
              <div class="moderation-event-head">
                <div class="reservation-details moderator-details">
                  <strong>${event.title}</strong>
                  <span>${formatDate(event.date)}</span>
                </div>
                <div class="moderator-meta">
                  <span class="status-pill ${hasPending ? "status-upcoming" : "status-played"}">
                    ${hasPending ? "Pendiente" : `Ganador: ${winnerLabel}`}
                  </span>
                </div>
              </div>

              <div class="moderation-scoreboard">
                <article>
                  <span class="value">${redTeam.length}</span>
                  <span class="label">Equipo rojo</span>
                </article>
                <article>
                  <span class="value">${blueTeam.length}</span>
                  <span class="label">Equipo azul</span>
                </article>
              </div>

              <div class="moderation-team-grid">
                <section class="moderation-team-column">
                  <h4>Equipo Rojo</h4>
                  <ul class="moderation-player-list">
                    ${
                      redTeam.length
                        ? redTeam
                            .map(
                              (reservation) => `
                                <li class="moderation-player-item">
                                  <strong>${reservation.playerName}</strong>
                                  <span>${reservation.playerEmail}</span>
                                </li>
                              `
                            )
                            .join("")
                        : "<li class='moderation-player-item empty'>Sin inscritos</li>"
                    }
                  </ul>
                </section>

                <section class="moderation-team-column">
                  <h4>Equipo Azul</h4>
                  <ul class="moderation-player-list">
                    ${
                      blueTeam.length
                        ? blueTeam
                            .map(
                              (reservation) => `
                                <li class="moderation-player-item">
                                  <strong>${reservation.playerName}</strong>
                                  <span>${reservation.playerEmail}</span>
                                </li>
                              `
                            )
                            .join("")
                        : "<li class='moderation-player-item empty'>Sin inscritos</li>"
                    }
                  </ul>
                </section>
              </div>

              <div class="reservation-actions">
                ${
                  hasPending
                    ? `
                      <button class="btn-result-loss" data-event-id="${event.id}" data-winning-team="rojo">
                        Gana Rojo
                      </button>
                      <button class="btn-result-win" data-event-id="${event.id}" data-winning-team="azul">
                        Gana Azul
                      </button>
                    `
                    : ""
                }
              </div>
            </li>
          `;
        })
        .join("")
    : "<li class='reservation-item'>No hay reservas para moderar.</li>";
}

function renderEvents() {
  const currentUser = state.currentUser;
  const seasonActive = state.currentSeason?.status === "active";

  refs.eventsGrid.innerHTML = state.events
    .map((event) => {
      const remaining = event.availableSlots;
      const booked = Math.max(0, Math.min(event.slots, event.slots - remaining));
      const currentReservation =
        currentUser?.reservations?.find(
          (reservation) => reservation.eventId === event.id && reservation.status === "upcoming"
        ) || null;
      const alreadyJoined = Boolean(currentReservation);

      const disabled = !currentUser || !seasonActive || booked >= event.slots || alreadyJoined;
      const selectedTeam = currentReservation?.team || "rojo";
      const teamDisabled = !currentUser || !seasonActive || booked >= event.slots || alreadyJoined;

      let buttonLabel = "Inscribirme";
      if (!currentUser) buttonLabel = "Inicia sesion";
      if (!seasonActive) buttonLabel = "Temporada cerrada";
      if (alreadyJoined) buttonLabel = "Ya inscrito";
      if (booked >= event.slots) buttonLabel = "Cupos completos";

      return `
        <article class="event-card" data-event-id="${event.id}">
          <div class="event-meta">
            <span>${formatDate(event.date)}</span>
            <span>${event.level}</span>
          </div>
          <div class="event-title">${event.title}</div>
          <div class="event-meta">
            <span>${event.price}</span>
            <span>${booked}/${event.slots} inscritos</span>
          </div>
          <label class="team-picker">
            <span>Elige bando</span>
            <select data-team-select ${teamDisabled ? "disabled" : ""}>
              <option value="rojo" ${selectedTeam === "rojo" ? "selected" : ""}>Equipo Rojo</option>
              <option value="azul" ${selectedTeam === "azul" ? "selected" : ""}>Equipo Azul</option>
            </select>
          </label>
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

async function refreshCurrentSeason() {
  if (!state.token) {
    state.currentSeason = null;
    return;
  }

  try {
    const data = await apiRequest("/api/seasons/current");
    state.currentSeason = data.season || null;
  } catch (_error) {
    state.currentSeason = null;
  }
}

async function refreshModerationReservations() {
  if (!isStaffRole(state.currentUser?.role)) {
    state.moderationReservations = [];
    return;
  }

  const data = await apiRequest("/api/moderation/reservations");
  state.moderationReservations = data.reservations || [];
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
    state.moderationReservations = [];
    await refreshCurrentSeason();
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
    await refreshCurrentSeason();
    refs.loginForm.reset();
    showMessage("Sesion iniciada. Revisa tus partidas en el panel.");
    await refreshEvents();
    await refreshModerationReservations();
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
  state.moderationReservations = [];
  state.currentSeason = null;
  showMessage("Sesion cerrada.");
  await refreshEvents();
  render();
}

async function joinEvent(eventId, team) {
  if (!state.currentUser) {
    showMessage("Debes iniciar sesion para inscribirte.", true);
    return;
  }

  try {
    const data = await apiRequest(`/api/events/${eventId}/reserve`, {
      method: "POST",
      body: JSON.stringify({ team }),
    });
    state.currentUser = data.user;
    showMessage(
      `Reserva confirmada para ${data.reservation.eventTitle} en ${getTeamLabel(data.reservation.team)}.`
    );
    await refreshEvents();
    await refreshModerationReservations();
    render();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function submitWinningTeam(eventId, winningTeam) {
  try {
    const data = await apiRequest(`/api/moderation/events/${eventId}/result`, {
      method: "POST",
      body: JSON.stringify({ winningTeam }),
    });

    await refreshModerationReservations();
    await refreshEvents();
    await refreshCurrentUser();
    render();
    showMessage(`Ganador registrado para ${data.event.title}: ${getTeamLabel(data.event.winningTeam)}.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function endSeason() {
  try {
    await apiRequest("/api/moderation/seasons/end", { method: "POST" });
    await refreshCurrentSeason();
    await refreshModerationReservations();
    await refreshEvents();
    await refreshCurrentUser();
    render();
    showMessage("Temporada finalizada. Puedes iniciar una nueva cuando quieras.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function startSeason() {
  try {
    const data = await apiRequest("/api/moderation/seasons/start", { method: "POST" });
    await refreshCurrentSeason();
    await refreshModerationReservations();
    await refreshEvents();
    await refreshCurrentUser();
    render();
    showMessage(`${data.season.name} iniciada. Las estadisticas fueron reiniciadas.`);
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

    const eventCard = target.closest(".event-card");
    const teamSelect = eventCard?.querySelector("select[data-team-select]");
    const team = teamSelect instanceof HTMLSelectElement ? teamSelect.value : "";

    await joinEvent(eventId, team);
  });

  refs.moderatorRefreshBtn.addEventListener("click", async () => {
    await refreshCurrentUser();
    await refreshCurrentSeason();
    await refreshModerationReservations();
    await refreshEvents();
    render();
    showMessage("Panel de moderacion actualizado.");
  });

  refs.seasonEndBtn.addEventListener("click", async () => {
    await endSeason();
  });

  refs.seasonStartBtn.addEventListener("click", async () => {
    await startSeason();
  });

  refs.moderatorReservationsList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const eventId = target.dataset.eventId;
    const winningTeam = target.dataset.winningTeam;

    if (!eventId || !winningTeam) return;

    await submitWinningTeam(eventId, winningTeam);
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
  renderModeratorPanel();
  renderEvents();
}

async function init() {
  switchPageTab("inicio");
  setupEvents();

  await refreshEvents();
  await refreshCurrentUser();
  await refreshCurrentSeason();
  await refreshModerationReservations();

  render();
}

init();
