const STORAGE_TOKEN = "cqb_token";

const state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  currentUser: null,
  emailVerificationResult: null,
  isHeaderMenuOpen: false,
  events: [],
  moderationReservations: [],
  moderationPlayers: [],
  moderationEvents: [],
  moderatorActiveView: "reservas",
  moderationSearchText: "",
  moderationSearchCategory: "name",
  moderationSearchDirection: "desc",
  moderationSearchPage: 1,
  moderationSearchPageSize: 10,
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
  forgotPasswordBtn: document.getElementById("forgot-password-btn"),
  authMessage: document.getElementById("auth-message"),
  welcomeText: document.getElementById("welcome-text"),
  emailVerificationBanner: document.getElementById("email-verification-banner"),
  emailVerificationText: document.getElementById("email-verification-text"),
  resendVerificationBtn: document.getElementById("resend-verification-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  reservationsList: document.getElementById("reservations-list"),
  moderatorPanel: document.getElementById("moderator-panel"),
  moderatorPendingCount: document.getElementById("moderator-pending-count"),
  moderatorPlayedCount: document.getElementById("moderator-played-count"),
  moderatorReservationsList: document.getElementById("moderator-reservations-list"),
  moderatorPlayersList: document.getElementById("moderator-players-list"),
  moderatorSearchResults: document.getElementById("moderator-search-results"),
  moderatorSearchInput: document.getElementById("moderator-search-input"),
  moderatorSearchCategory: document.getElementById("moderator-search-category"),
  moderatorSearchDirection: document.getElementById("moderator-search-direction"),
  moderatorSearchPageSize: document.getElementById("moderator-search-page-size"),
  moderatorSearchPrev: document.getElementById("moderator-search-prev"),
  moderatorSearchNext: document.getElementById("moderator-search-next"),
  moderatorSearchPageInfo: document.getElementById("moderator-search-page-info"),
  moderatorViewTabs: Array.from(document.querySelectorAll(".moderator-view-tab")),
  moderatorViewReservas: document.getElementById("moderator-view-reservas"),
  moderatorViewJugadores: document.getElementById("moderator-view-jugadores"),
  moderatorViewBusqueda: document.getElementById("moderator-view-busqueda"),
  moderatorViewCalendario: document.getElementById("moderator-view-calendario"),
  moderatorEventForm: document.getElementById("moderator-event-form"),
  moderatorEventsList: document.getElementById("moderator-events-list"),
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
  headerUserMenu: document.getElementById("header-user-menu"),
  headerPlayerName: document.getElementById("header-player-name"),
  headerPlayerNameText: document.getElementById("header-player-name-text"),
  headerUserDropdown: document.getElementById("header-user-dropdown"),
  headerLogoutBtn: document.getElementById("header-logout-btn"),
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

function consumeEmailVerificationResult() {
  const params = new URLSearchParams(window.location.search);
  const status = String(params.get("emailVerification") || "").trim();
  if (!status) return null;

  params.delete("emailVerification");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
  return status;
}

function showEmailVerificationFeedback(status) {
  if (!status) return;

  if (status === "verified") {
    showMessage("Correo verificado con exito. Ya puedes inscribirte a partidas.");
    return;
  }

  if (status === "expired") {
    showMessage("El enlace de verificacion expiro. Inicia sesion y solicita uno nuevo.", true);
    return;
  }

  showMessage("El enlace de verificacion no es valido o ya fue utilizado.", true);
}

function renderHeroMetrics() {
  const now = new Date();
  refs.eventsMonthValue.textContent = String(getEventsInMonth(now));
  refs.eventsMonthLabel.textContent = "Eventos este mes";
}

function closeHeaderMenu() {
  state.isHeaderMenuOpen = false;
  refs.headerPlayerName?.setAttribute("aria-expanded", "false");
  refs.headerUserDropdown?.classList.add("hidden");
}

function toggleHeaderMenu() {
  state.isHeaderMenuOpen = !state.isHeaderMenuOpen;
  refs.headerPlayerName?.setAttribute("aria-expanded", state.isHeaderMenuOpen ? "true" : "false");
  refs.headerUserDropdown?.classList.toggle("hidden", !state.isHeaderMenuOpen);
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
    refs.headerUserMenu.classList.add("hidden");
    refs.headerPlayerNameText.textContent = "";
    refs.emailVerificationBanner.classList.add("hidden");
    refs.emailVerificationText.textContent = "";
    closeHeaderMenu();
    return;
  }

  refs.authGuestView.classList.add("hidden");
  refs.authUserView.classList.remove("hidden");
  refs.welcomeText.textContent = `Bienvenido, ${user.name}.`;
  refs.headerCta.classList.add("hidden");
  refs.headerUserMenu.classList.remove("hidden");
  refs.headerPlayerNameText.textContent = user.name;
  refs.headerPlayerName.setAttribute("aria-expanded", state.isHeaderMenuOpen ? "true" : "false");
  refs.headerUserDropdown.classList.toggle("hidden", !state.isHeaderMenuOpen);

  const needsVerification = !user.emailVerified;
  refs.emailVerificationBanner.classList.toggle("hidden", !needsVerification);
  refs.emailVerificationText.textContent = needsVerification
    ? `Debes verificar ${user.email} para habilitar reservas. Revisa tu bandeja de entrada o solicita un nuevo enlace.`
    : "";
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

function renderModerationPlayerItem(reservation, isLocked) {
  const currentTeam = reservation.team === "azul" ? "azul" : "rojo";

  return `
    <li class="moderation-player-item">
      <div class="moderation-player-head">
        <strong>${reservation.playerName}</strong>
        <span>${reservation.playerEmail}</span>
      </div>
      <div class="moderation-player-actions">
        <select data-reservation-team-select data-reservation-id="${reservation.id}" ${isLocked ? "disabled" : ""}>
          <option value="rojo" ${currentTeam === "rojo" ? "selected" : ""}>Equipo Rojo</option>
          <option value="azul" ${currentTeam === "azul" ? "selected" : ""}>Equipo Azul</option>
        </select>
        <button
          class="btn-team-switch"
          type="button"
          data-action="switch-team"
          data-reservation-id="${reservation.id}"
          ${isLocked ? "disabled" : ""}
        >
          Cambiar
        </button>
      </div>
    </li>
  `;
}

function renderModeratorPlayerRow(player) {
  const roleLabel = player.role === "admin" ? "Admin" : player.role === "moderator" ? "Moderador" : "Jugador";
  return `
    <li class="moderation-player-row">
      <div class="moderation-player-main">
        <strong>${player.name}</strong>
        <span>${player.email}</span>
      </div>
      <div class="moderation-player-stats">
        <span class="status-pill status-upcoming">${roleLabel}</span>
        <span>Partidas: ${player.matchesPlayed}</span>
        <span>V: ${player.wins} | D: ${player.losses}</span>
        <span>Activas: ${player.activeReservations}</span>
      </div>
    </li>
  `;
}

function getModerationSearchResults() {
  const category = state.moderationSearchCategory;
  const direction = state.moderationSearchDirection === "asc" ? "asc" : "desc";
  const text = state.moderationSearchText.trim().toLowerCase();
  const players = [...state.moderationPlayers];

  const filtered = players.filter((player) => {
    if (!text) return true;

    if (category === "wins") {
      return String(player.wins || 0).includes(text);
    }

    if (category === "losses") {
      return String(player.losses || 0).includes(text);
    }

    if (category === "email") {
      return String(player.email || "").toLowerCase().includes(text);
    }

    if (category === "role") {
      return String(player.role || "").toLowerCase().includes(text);
    }

    return String(player.name || "").toLowerCase().includes(text);
  });

  const sorted = filtered.sort((left, right) => {
    let leftValue;
    let rightValue;

    if (category === "wins") {
      leftValue = Number(left.wins || 0);
      rightValue = Number(right.wins || 0);
    } else if (category === "losses") {
      leftValue = Number(left.losses || 0);
      rightValue = Number(right.losses || 0);
    } else if (category === "email") {
      leftValue = String(left.email || "").toLowerCase();
      rightValue = String(right.email || "").toLowerCase();
    } else if (category === "role") {
      leftValue = String(left.role || "").toLowerCase();
      rightValue = String(right.role || "").toLowerCase();
    } else {
      leftValue = String(left.name || "").toLowerCase();
      rightValue = String(right.name || "").toLowerCase();
    }

    if (leftValue < rightValue) return direction === "asc" ? -1 : 1;
    if (leftValue > rightValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

function getModerationSearchPageData() {
  const allResults = getModerationSearchResults();
  const pageSize = Math.max(1, Number(state.moderationSearchPageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(allResults.length / pageSize));
  const currentPage = Math.min(Math.max(1, state.moderationSearchPage), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  state.moderationSearchPage = currentPage;

  return {
    items: allResults.slice(start, end),
    totalItems: allResults.length,
    totalPages,
    currentPage,
  };
}

function switchModeratorView(viewName) {
  const nextView = ["reservas", "jugadores", "busqueda", "calendario"].includes(viewName)
    ? viewName
    : "reservas";
  state.moderatorActiveView = nextView;

  refs.moderatorViewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.moderatorView === nextView);
  });

  refs.moderatorViewReservas?.classList.toggle("hidden", nextView !== "reservas");
  refs.moderatorViewJugadores?.classList.toggle("hidden", nextView !== "jugadores");
  refs.moderatorViewBusqueda?.classList.toggle("hidden", nextView !== "busqueda");
  refs.moderatorViewCalendario?.classList.toggle("hidden", nextView !== "calendario");
}

function renderModeratorPanel() {
  const user = state.currentUser;
  const isModerator = isStaffRole(user?.role);

  refs.moderatorPanel.classList.toggle("hidden", !isModerator);
  if (!isModerator) {
    refs.moderatorPendingCount.textContent = "0";
    refs.moderatorPlayedCount.textContent = "0";
    refs.moderatorReservationsList.innerHTML = "";
    refs.moderatorPlayersList.innerHTML = "";
    refs.moderatorSearchResults.innerHTML = "";
    refs.moderatorEventsList.innerHTML = "";
    if (refs.moderatorSearchPageInfo) {
      refs.moderatorSearchPageInfo.textContent = "Pagina 1 de 1";
    }
    if (refs.moderatorSearchPrev) refs.moderatorSearchPrev.disabled = true;
    if (refs.moderatorSearchNext) refs.moderatorSearchNext.disabled = true;
    switchModeratorView("reservas");
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
                            .map((reservation) => renderModerationPlayerItem(reservation, !hasPending))
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
                            .map((reservation) => renderModerationPlayerItem(reservation, !hasPending))
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

  refs.moderatorPlayersList.innerHTML = state.moderationPlayers.length
    ? state.moderationPlayers.map(renderModeratorPlayerRow).join("")
    : "<li class='reservation-item'>No hay jugadores registrados.</li>";

  refs.moderatorEventsList.innerHTML = state.moderationEvents.length
    ? state.moderationEvents
        .map((event) => {
          const canCancel = Number(event.enrolledTotal || 0) === 0;
          return `
            <li class="moderation-event-card">
              <div class="moderation-event-head">
                <div class="reservation-details moderator-details">
                  <strong>${event.title}</strong>
                  <span>${formatDate(event.date)}</span>
                  <span>${event.level} | ${event.price}</span>
                </div>
                <div class="moderator-meta">
                  <span class="status-pill status-upcoming">Cupos: ${event.availableSlots}/${event.slots}</span>
                  <span class="status-pill ${canCancel ? "status-upcoming" : "status-played"}">
                    Inscritos: ${event.enrolledTotal}
                  </span>
                </div>
              </div>

              <div class="moderation-scoreboard">
                <article>
                  <span class="value">${event.enrolledUpcoming}</span>
                  <span class="label">Pendientes</span>
                </article>
                <article>
                  <span class="value">${event.enrolledPlayed}</span>
                  <span class="label">Cerradas</span>
                </article>
              </div>

              <div class="reservation-actions">
                <button
                  class="btn btn-danger"
                  type="button"
                  data-action="cancel-event"
                  data-event-id="${event.id}"
                  data-event-title="${event.title}"
                  ${canCancel ? "" : "disabled"}
                >
                  Cancelar partida
                </button>
              </div>
            </li>
          `;
        })
        .join("")
    : "<li class='reservation-item'>No hay partidas cargadas en el calendario.</li>";

  const pageData = getModerationSearchPageData();
  refs.moderatorSearchResults.innerHTML = pageData.items.length
    ? pageData.items.map(renderModeratorPlayerRow).join("")
    : "<li class='reservation-item'>No hay resultados para esa busqueda.</li>";

  if (refs.moderatorSearchPageInfo) {
    refs.moderatorSearchPageInfo.textContent = `Pagina ${pageData.currentPage} de ${pageData.totalPages} | ${pageData.totalItems} jugadores`;
  }
  if (refs.moderatorSearchPrev) refs.moderatorSearchPrev.disabled = pageData.currentPage <= 1;
  if (refs.moderatorSearchNext) refs.moderatorSearchNext.disabled = pageData.currentPage >= pageData.totalPages;

  switchModeratorView(state.moderatorActiveView);
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

      const disabled = !currentUser || !seasonActive || !event.canInscribe || booked >= event.slots || alreadyJoined;
      const emailNotVerified = Boolean(currentUser && !currentUser.emailVerified);
      const selectedTeam = currentReservation?.team || "rojo";
      const teamDisabled = !currentUser || !seasonActive || !event.canInscribe || booked >= event.slots || alreadyJoined || emailNotVerified;

      const isDisabled = disabled || emailNotVerified;

      let buttonLabel = "Inscribirme y pagar";
      if (!currentUser) buttonLabel = "Inicia sesion";
      if (emailNotVerified) buttonLabel = "Verifica tu correo";
      if (!seasonActive) buttonLabel = "Temporada cerrada";
      if (!event.canInscribe) buttonLabel = "Abre lunes 00:00";
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
          <button class="btn btn-primary" data-event-id="${event.id}" ${isDisabled ? "disabled" : ""}>
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

async function refreshModerationPlayers() {
  if (!isStaffRole(state.currentUser?.role)) {
    state.moderationPlayers = [];
    return;
  }

  const data = await apiRequest("/api/moderation/players");
  state.moderationPlayers = data.players || [];
}

async function refreshModerationEvents() {
  if (!isStaffRole(state.currentUser?.role)) {
    state.moderationEvents = [];
    return;
  }

  const data = await apiRequest("/api/moderation/events");
  state.moderationEvents = data.events || [];
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
    showMessage(data.message || "Cuenta creada con exito. Revisa tu correo para verificarla.");
    await refreshEvents();
    await refreshModerationReservations();
    await refreshModerationPlayers();
    await refreshModerationEvents();
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
    showMessage(
      data.verificationRequired
        ? "Sesion iniciada. Debes verificar tu correo para poder reservar."
        : "Sesion iniciada. Revisa tus partidas en el panel."
    );
    await refreshEvents();
    await refreshModerationReservations();
    await refreshModerationPlayers();
    await refreshModerationEvents();
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
  state.moderationPlayers = [];
  state.moderationEvents = [];
  state.currentSeason = null;
  showMessage("Sesion cerrada.");
  await refreshEvents();
  render();
}

async function resendVerificationEmail() {
  try {
    const data = await apiRequest("/api/auth/resend-verification", { method: "POST" });
    await refreshCurrentUser();
    render();
    showMessage(data.message || "Te enviamos un nuevo enlace de verificacion.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function requestPasswordReset() {
  const emailInput = refs.loginForm?.querySelector('input[name="email"]');
  const loginEmail = emailInput instanceof HTMLInputElement ? emailInput.value.trim().toLowerCase() : "";
  const promptEmail = loginEmail || window.prompt("Ingresa tu correo para recuperar contrasena:", "") || "";
  const email = String(promptEmail).trim().toLowerCase();

  if (!email) {
    showMessage("Debes ingresar un correo para continuar.", true);
    return;
  }

  try {
    const data = await apiRequest("/api/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    showMessage(data.message || "Si el correo existe, te enviamos un enlace de recuperacion.");
  } catch (error) {
    showMessage(error.message, true);
  }
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
    await refreshModerationPlayers();
    await refreshEvents();
    await refreshCurrentUser();
    render();
    showMessage(`Ganador registrado para ${data.event.title}: ${getTeamLabel(data.event.winningTeam)}.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function updateReservationTeam(reservationId, team) {
  try {
    await apiRequest(`/api/moderation/reservations/${reservationId}/team`, {
      method: "POST",
      body: JSON.stringify({ team }),
    });

    await refreshModerationReservations();
    await refreshCurrentUser();
    render();
    showMessage(`Equipo actualizado: ${getTeamLabel(team)}.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function endSeason() {
  try {
    await apiRequest("/api/moderation/seasons/end", { method: "POST" });
    await refreshCurrentSeason();
    await refreshModerationReservations();
    await refreshModerationPlayers();
    await refreshModerationEvents();
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
    await refreshModerationPlayers();
    await refreshModerationEvents();
    await refreshEvents();
    await refreshCurrentUser();
    render();
    showMessage(`${data.season.name} iniciada. Las estadisticas fueron reiniciadas.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function createModerationEvent(formData) {
  const title = formData.get("title")?.toString().trim();
  const date = formData.get("date")?.toString().trim();
  const level = formData.get("level")?.toString().trim() || "Intermedio";
  const slots = Number(formData.get("slots"));

  if (!title || !date || Number.isNaN(slots)) {
    showMessage("Completa todos los campos para crear una partida.", true);
    return;
  }

  try {
    await apiRequest("/api/moderation/events", {
      method: "POST",
      body: JSON.stringify({ title, date, level, slots }),
    });

    refs.moderatorEventForm.reset();
    await refreshEvents();
    await refreshModerationEvents();
    render();
    showMessage("Partida creada y agregada al calendario.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function cancelModerationEvent(eventId, eventTitle) {
  try {
    await apiRequest(`/api/moderation/events/${eventId}`, { method: "DELETE" });
    await refreshEvents();
    await refreshModerationEvents();
    await refreshModerationReservations();
    render();
    showMessage(`Partida cancelada: ${eventTitle}.`);
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

  refs.forgotPasswordBtn?.addEventListener("click", async () => {
    await requestPasswordReset();
  });

  refs.resendVerificationBtn?.addEventListener("click", async () => {
    await resendVerificationEmail();
  });

  refs.headerPlayerName?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHeaderMenu();
  });

  refs.headerLogoutBtn?.addEventListener("click", async () => {
    closeHeaderMenu();
    await logoutUser();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!state.isHeaderMenuOpen) return;
    if (refs.headerUserMenu?.contains(target)) return;
    closeHeaderMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isHeaderMenuOpen) {
      closeHeaderMenu();
    }
  });

  refs.eventsGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const eventId = target.dataset.eventId;
    if (!eventId || target.disabled) return;

    const eventCard = target.closest(".event-card");
    const teamSelect = eventCard?.querySelector("select[data-team-select]");
    const team = teamSelect instanceof HTMLSelectElement ? teamSelect.value : "rojo";

    const params = new URLSearchParams({ eventId, team });
    window.location.href = `/inscripcion.html?${params.toString()}`;
  });

  refs.moderatorRefreshBtn.addEventListener("click", async () => {
    await refreshCurrentUser();
    await refreshCurrentSeason();
    await refreshModerationReservations();
    await refreshModerationPlayers();
    await refreshModerationEvents();
    await refreshEvents();
    render();
    showMessage("Panel de moderacion actualizado.");
  });

  refs.moderatorEventForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createModerationEvent(new FormData(refs.moderatorEventForm));
  });

  refs.moderatorViewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      switchModeratorView(button.dataset.moderatorView);
    });
  });

  refs.moderatorSearchInput?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    state.moderationSearchText = target.value;
    state.moderationSearchPage = 1;
    renderModeratorPanel();
  });

  refs.moderatorSearchCategory?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.moderationSearchCategory = target.value;
    state.moderationSearchPage = 1;
    renderModeratorPanel();
  });

  refs.moderatorSearchDirection?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.moderationSearchDirection = target.value;
    state.moderationSearchPage = 1;
    renderModeratorPanel();
  });

  refs.moderatorSearchPageSize?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.moderationSearchPageSize = Math.max(1, Number(target.value) || 10);
    state.moderationSearchPage = 1;
    renderModeratorPanel();
  });

  refs.moderatorSearchPrev?.addEventListener("click", () => {
    state.moderationSearchPage = Math.max(1, state.moderationSearchPage - 1);
    renderModeratorPanel();
  });

  refs.moderatorSearchNext?.addEventListener("click", () => {
    state.moderationSearchPage += 1;
    renderModeratorPanel();
  });

  refs.seasonEndBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "⚠️ Esto cerrará la temporada actual y reiniciará todas las estadísticas de los jugadores.\n\n¿Estás seguro de que quieres terminar la temporada?"
    );
    if (confirmed) {
      await endSeason();
    }
  });

  refs.seasonStartBtn.addEventListener("click", async () => {
    await startSeason();
  });

  refs.moderatorReservationsList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    if (target.dataset.action === "switch-team") {
      const reservationId = target.dataset.reservationId;
      if (!reservationId) return;

      const select = refs.moderatorReservationsList.querySelector(
        `select[data-reservation-team-select][data-reservation-id="${reservationId}"]`
      );
      const selectedTeam = select instanceof HTMLSelectElement ? select.value : "";
      if (!["rojo", "azul"].includes(selectedTeam)) {
        showMessage("Selecciona un equipo valido para continuar.", true);
        return;
      }

      await updateReservationTeam(reservationId, selectedTeam);
      return;
    }

    const eventId = target.dataset.eventId;
    const winningTeam = target.dataset.winningTeam;

    if (!eventId || !winningTeam) return;

    await submitWinningTeam(eventId, winningTeam);
  });

  refs.moderatorEventsList?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.action !== "cancel-event") return;

    const eventId = target.dataset.eventId;
    const eventTitle = target.dataset.eventTitle || "Partida";
    if (!eventId) return;

    const confirmed = window.confirm(
      `Se cancelara la partida \"${eventTitle}\". Esta accion no se puede deshacer.\n\n¿Quieres continuar?`
    );
    if (!confirmed) return;

    await cancelModerationEvent(eventId, eventTitle);
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
  state.emailVerificationResult = consumeEmailVerificationResult();
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const allowedTabs = ["inicio", "partidas", "moderar", "contacto"];
  const initialTab = allowedTabs.includes(urlTab) ? urlTab : "inicio";

  switchPageTab(initialTab);
  setupEvents();

  await refreshEvents();
  await refreshCurrentUser();
  await refreshCurrentSeason();
  await refreshModerationReservations();
  await refreshModerationPlayers();
  await refreshModerationEvents();

  render();
  showEmailVerificationFeedback(state.emailVerificationResult);
}

init();
