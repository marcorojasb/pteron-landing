(() => {
  const SESSION_KEY = "pteron-account-session";
  const PENDING_ACTIVATION_KEY = "pteron-pending-activation";
  const authPanel = document.querySelector("[data-auth-panel]");
  const dashboard = document.querySelector("[data-dashboard]");
  const notice = document.querySelector("[data-account-notice]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const linkSent = document.querySelector("[data-link-sent]");
  const requestedPlan = ["basic", "pro"].includes(new URL(window.location.href).searchParams.get("plan"))
    ? new URL(window.location.href).searchParams.get("plan")
    : "";
  const session = loadSession();
  let account = null;
  let pendingActivation = readPendingActivation();

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return value?.access_token && value?.refresh_token ? value : null;
    } catch {
      return null;
    }
  }

  function saveSession(value) {
    if (!value?.access_token || !value?.refresh_token) return;
    Object.assign(session || {}, value);
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PENDING_ACTIVATION_KEY);
    window.location.reload();
  }

  function readPendingActivation() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("activate");
    if (code && /^[a-f0-9]{32,128}$/i.test(code)) {
      localStorage.setItem(PENDING_ACTIVATION_KEY, code);
      url.searchParams.delete("activate");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return code;
    }
    return localStorage.getItem(PENDING_ACTIVATION_KEY) || "";
  }

  function consumeAuthHash() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      saveSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: Number(hash.get("expires_in") || 3600),
        expires_at: Date.now() + Number(hash.get("expires_in") || 3600) * 1000,
        token_type: hash.get("token_type") || "bearer",
      });
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      return true;
    }
    const error = hash.get("error_description") || hash.get("error");
    if (error) {
      showLoginMessage(decodeURIComponent(error.replace(/\+/g, " ")));
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
    return false;
  }

  async function refreshSession() {
    const current = loadSession();
    if (!current?.refresh_token) throw new Error("Tu sesión ya no está disponible.");
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    const data = await readResponse(response);
    saveSession({
      ...data,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
    });
    return data.access_token;
  }

  async function api(path, options = {}, retry = true) {
    const current = loadSession();
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (current?.access_token) headers.set("Authorization", `Bearer ${current.access_token}`);
    const response = await fetch(path, { ...options, headers });
    if (response.status === 401 && retry && current?.refresh_token) {
      await refreshSession();
      return api(path, options, false);
    }
    return readResponse(response);
  }

  async function readResponse(response) {
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
      const error = new Error(data?.message || "No pudimos completar la solicitud.");
      error.code = data?.error || "request_failed";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showNotice(message, tone = "") {
    if (!notice) return;
    notice.textContent = message || "";
    notice.dataset.tone = tone;
    notice.hidden = !message;
  }

  function showLoginMessage(message) {
    if (loginMessage) loginMessage.textContent = message || "";
  }

  function setDashboardVisible(isVisible) {
    authPanel.hidden = isVisible;
    dashboard.hidden = !isVisible;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(date);
  }

  function planName(plan) {
    return { basic: "Basic", pro: "Pro", free: "Gratis" }[plan] || plan || "Gratis";
  }

  function subscriptionLabel(subscription) {
    if (subscription.cancel_at_period_end) return "Termina al cierre";
    return {
      trialing: "En prueba",
      active: "Activa",
      past_due: "Pago pendiente",
      paused: "Pausada",
      canceled: "Cancelada",
      expired: "Terminada",
      incomplete: "Pendiente",
    }[subscription.status] || subscription.status;
  }

  function renderIdentity(data) {
    const email = data?.user?.email || "";
    const displayName = String(data?.profile?.display_name || email.split("@")[0] || "profesor").trim();
    document.querySelector("[data-account-email]").textContent = email;
    document.querySelector("[data-display-name]").textContent = displayName;
  }

  function renderPlans(data) {
    const current = data.subscriptions?.find((item) => ["incomplete", "trialing", "active", "past_due", "paused"].includes(item.status));
    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      const isCurrent = current?.plan_id === card.dataset.planCard;
      card.dataset.current = String(Boolean(isCurrent));
      const button = card.querySelector("button");
      if (button) {
        button.disabled = Boolean(isCurrent);
        button.textContent = isCurrent ? "Plan actual" : `Elegir ${planName(card.dataset.planCard)}`;
      }
    });
    if (requestedPlan) {
      const card = document.querySelector(`[data-plan-card="${requestedPlan}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => card?.querySelector("button")?.focus(), 250);
    }
  }

  function renderSubscription(data) {
    const current = data.subscriptions?.find((item) => ["incomplete", "trialing", "active", "past_due", "paused"].includes(item.status));
    const empty = document.querySelector("[data-subscription-empty]");
    const summary = document.querySelector("[data-subscription-summary]");
    const cancel = document.querySelector("[data-cancel-subscription]");
    if (!current) {
      empty.hidden = false;
      summary.hidden = true;
      cancel.hidden = true;
      return;
    }
    empty.hidden = true;
    summary.hidden = false;
    summary.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "subscription-plan";
    const name = document.createElement("strong");
    name.textContent = planName(current.plan_id);
    const status = document.createElement("span");
    status.textContent = subscriptionLabel(current);
    heading.append(name, status);
    const list = document.createElement("dl");
    const rows = [
      [current.status === "trialing" ? "Prueba hasta" : "Próximo periodo", current.status === "trialing" ? current.trial_ends_at : current.current_period_end],
      ["Creado", current.created_at],
    ];
    rows.forEach(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = formatDate(value);
      list.append(term, detail);
    });
    summary.append(heading, list);
    cancel.hidden = Boolean(current.cancel_at_period_end);
    cancel.textContent = current.cancel_at_period_end ? "Renovación cancelada" : "Cancelar renovación";
  }

  function renderLicenses(data) {
    const list = document.querySelector("[data-license-list]");
    list.innerHTML = "";
    if (!data.licenses?.length) {
      const empty = document.createElement("p");
      empty.className = "account-muted";
      empty.textContent = "Todavía no hay licencias emitidas.";
      list.append(empty);
      return;
    }
    data.licenses.forEach((license) => {
      const row = document.createElement("div");
      row.className = "license-row";
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = `${planName(license.plan_id)} · licencia local`;
      const detail = document.createElement("span");
      detail.textContent = `Emitida ${formatDate(license.issued_at)} · vence ${formatDate(license.expires_at)}`;
      copy.append(name, detail);
      const state = document.createElement("span");
      state.className = "license-row-status";
      state.textContent = license.status === "active" ? "Vigente" : license.status;
      row.append(copy, state);
      list.append(row);
    });
  }

  function renderActivation() {
    const pending = document.querySelector("[data-activation-pending]");
    const idle = document.querySelector("[data-activation-idle]");
    const result = document.querySelector("[data-activation-result]");
    const openApp = document.querySelector("[data-open-app]");
    pending.hidden = !pendingActivation;
    idle.hidden = Boolean(pendingActivation);
    result.hidden = true;
    openApp.removeAttribute("href");
  }

  async function loadAccount() {
    try {
      account = await api("/api/account");
      setDashboardVisible(true);
      renderIdentity(account);
      renderPlans(account);
      renderSubscription(account);
      renderLicenses(account);
      renderActivation();
      showNotice("");
      if (pendingActivation) showNotice("Este equipo está listo para ser autorizado. Revisa la sección «Activar pteron».", "success");
    } catch (error) {
      if (error.status === 401) {
        setDashboardVisible(false);
        showNotice("Tu sesión expiró. Solicita un nuevo enlace para entrar.", "error");
        return;
      }
      setDashboardVisible(false);
      showNotice(error.message, "error");
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    const input = loginForm.querySelector("input[name=email]");
    const button = loginForm.querySelector("button");
    showLoginMessage("");
    button.disabled = true;
    try {
      await api("/api/auth/request-magic-link", {
        method: "POST",
        body: JSON.stringify({ email: input.value }),
      });
      linkSent.hidden = false;
      showLoginMessage("");
    } catch (error) {
      showLoginMessage(error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function checkout(plan) {
    const button = document.querySelector(`[data-checkout-plan="${plan}"]`);
    if (button) button.disabled = true;
    showNotice("Estamos preparando el registro seguro de tu tarjeta con Flow…");
    try {
      const result = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!result?.redirectUrl || !/^https:\/\//i.test(result.redirectUrl)) throw new Error("El enlace de pago no es válido.");
      window.location.assign(result.redirectUrl);
    } catch (error) {
      showNotice(error.message, "error");
      if (button) button.disabled = false;
    }
  }

  async function cancelSubscription() {
    if (!window.confirm("La renovación se detendrá al terminar el periodo actual. ¿Quieres continuar?")) return;
    const button = document.querySelector("[data-cancel-subscription]");
    button.disabled = true;
    try {
      const result = await api("/api/billing/cancel", { method: "POST", body: "{}" });
      showNotice(result.cancelAt ? `Renovación cancelada. Tu acceso sigue hasta ${formatDate(result.cancelAt)}.` : "Renovación cancelada.", "success");
      await loadAccount();
    } catch (error) {
      showNotice(error.message, "error");
      button.disabled = false;
    }
  }

  async function confirmActivation() {
    if (!pendingActivation) return;
    const button = document.querySelector("[data-confirm-activation]");
    button.disabled = true;
    showNotice("Estamos autorizando este equipo…");
    try {
      const result = await api("/api/activation/complete", {
        method: "POST",
        body: JSON.stringify({ code: pendingActivation }),
      });
      const openApp = document.querySelector("[data-open-app]");
      openApp.href = result.deepLink;
      document.querySelector("[data-activation-pending]").hidden = true;
      document.querySelector("[data-activation-idle]").hidden = true;
      document.querySelector("[data-activation-result]").hidden = false;
      localStorage.removeItem(PENDING_ACTIVATION_KEY);
      pendingActivation = "";
      showNotice("Equipo autorizado. Abre pteron para guardar la licencia.", "success");
    } catch (error) {
      showNotice(error.message, "error");
      button.disabled = false;
    }
  }

  function handleBillingReturn() {
    const billing = new URL(window.location.href).searchParams.get("billing");
    if (billing === "success") showNotice("Tu plan quedó registrado. Estamos sincronizando la primera licencia.", "success");
    if (billing === "cancelled") showNotice("El registro de tarjeta se canceló. No se creó ningún plan.");
    if (billing === "error") showNotice("Flow no pudo confirmar el registro. Puedes intentarlo nuevamente.", "error");
  }

  loginForm?.addEventListener("submit", sendMagicLink);
  document.querySelector("[data-sign-out]")?.addEventListener("click", clearSession);
  document.querySelectorAll("[data-checkout-plan]").forEach((button) => {
    button.addEventListener("click", () => checkout(button.dataset.checkoutPlan));
  });
  document.querySelector("[data-cancel-subscription]")?.addEventListener("click", cancelSubscription);
  document.querySelector("[data-confirm-activation]")?.addEventListener("click", confirmActivation);

  consumeAuthHash();
  handleBillingReturn();
  if (loadSession()) loadAccount();
  else {
    setDashboardVisible(false);
    if (pendingActivation) {
      showNotice("Inicia sesión para autorizar el equipo que solicitó activación.");
    } else if (requestedPlan) {
      showNotice(`Inicia sesión para elegir el plan ${planName(requestedPlan)}.`);
    }
  }
})();
