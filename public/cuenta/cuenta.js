(() => {
  /* pteron · cuenta: entrada por enlace mágico, plan actual y uso de la IA incluida, resumen antes de Flow, retorno del
     pago y autorización de equipos. Lo que no toca el DOM —fechas de Chile, estado del plan, uso, resumen, avisos del
     retorno y lo guardado con vencimiento— va primero y queda en window.pteronCuenta, para probarlo sin navegador
     (tests/cuenta.test.js). */

  const SESSION_KEY = "pteron-account-session";
  const PENDING_ACTIVATION_KEY = "pteron-pending-activation";
  const REQUESTED_PLAN_KEY = "pteron-requested-plan";
  const DAY = 24 * 60 * 60 * 1000;
  // La activación que pide la app vence a los 60 minutos (src/routes/activation.js), lo que puede tardar el enlace
  // mágico más el viaje a Flow; el plan elegido en /planes se recuerda una hora, lo que tarda en llegar y abrirse
  // el enlace mágico.
  const ACTIVATION_TTL = 60 * 60 * 1000;
  const REQUESTED_PLAN_TTL = 60 * 60 * 1000;
  // Los estados con que el checkout responde «Ya tienes un plan en curso» (src/routes/billing.js)
  const CURRENT_STATUSES = ["incomplete", "trialing", "active", "past_due", "paused"];
  const PLAN_IDS = ["basic", "pro"];
  const TERMS_VERSION = /^\d{4}-\d{2}-\d{2}$/;
  const CONTACT = "pteron@patagua.dev";

  const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

  // Las fechas de cobro son días del calendario de Chile, como las escribe Flow: se muestran en su zona y no en la del
  // equipo, que a un docente de viaje le correría el día.
  function dateFormat(options, timeZone = "America/Santiago") {
    try {
      return new Intl.DateTimeFormat("es-CL", { timeZone, ...options });
    } catch {
      return new Intl.DateTimeFormat("es-CL", options);
    }
  }
  const longDate = dateFormat({ day: "numeric", month: "long", year: "numeric" });
  const shortDate = dateFormat({ day: "numeric", month: "short", year: "numeric" });
  const dayParts = dateFormat({ year: "numeric", month: "numeric", day: "numeric" });
  const calendarDate = dateFormat({ day: "numeric", month: "long", year: "numeric" }, "UTC");

  function instant(value) {
    const time = typeof value === "number" ? value : Date.parse(value ?? "");
    return Number.isFinite(time) ? time : null;
  }

  function formatDate(value) {
    const time = instant(value);
    return time === null ? "—" : shortDate.format(time);
  }

  function formatLongDate(value) {
    const time = instant(value);
    return time === null ? "" : longDate.format(time);
  }

  /** El día de Chile en que cae `now`, como medianoche UTC: así se suman días sin que el cambio de hora los mueva. */
  function chileDay(now) {
    const parts = {};
    for (const { type, value } of dayParts.formatToParts(new Date(now))) parts[type] = Number(value);
    return Date.UTC(parts.year, parts.month - 1, parts.day);
  }

  const pesos = (amount) => `$${number.format(amount)}`;

  // La cortesía `tester` da lo mismo que Basic y su licencia se firma como Basic: se nombra así, con la etiqueta «Cortesía»
  function planName(plan) {
    return { basic: "Basic", pro: "Pro", free: "Gratis", tester: "Basic" }[plan] || plan || "Gratis";
  }

  const isComp = (subscription) => subscription?.provider === "comp" || subscription?.plan_id === "tester";
  // La sincronización pasa a past_due lo que Flow marca moroso; si una fila llegara con la marca y sin el estado, manda
  // la marca: antes que anunciar un próximo cobro, se ofrece pagar el pendiente.
  const isPastDue = (subscription) => subscription?.status === "past_due" || (subscription?.status === "active" && Number(subscription.morose) === 1);

  function catalogPlan(account, planId) {
    return (account?.plans || []).find((plan) => plan.id === planId) || null;
  }

  function priceOf(plan) {
    const price = Number(plan?.monthly_price_clp);
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  /** La cuota de un período: la del plan o, en la prueba, la de prueba (un cuarto si el catálogo no fija otra). */
  function periodLimit(plan, trial) {
    if (plan?.ai_units_limit == null) return null;
    const full = Number(plan.ai_units_limit);
    if (!Number.isFinite(full) || full < 0) return null;
    if (!trial) return full;
    const reduced = plan.trial_ai_units_limit == null ? NaN : Number(plan.trial_ai_units_limit);
    return Number.isFinite(reduced) && reduced >= 0 ? reduced : Math.floor(full / 4);
  }

  /**
   * La suscripción en curso, la que el checkout no deja duplicar. Una cancelada al cierre cuyo período ya pasó deja de
   * estarlo aunque la fila todavía no se haya sincronizado: el checkout consulta Flow antes de decidir.
   */
  function currentSubscription(account, now) {
    return (account?.subscriptions || []).find((item) => {
      if (!CURRENT_STATUSES.includes(item.status)) return false;
      const end = instant(item.current_period_end);
      return !(item.cancel_at_period_end && end !== null && end <= now);
    }) || null;
  }

  /** Sólo se enlaza fuera del sitio a Flow y por https: el registro de la tarjeta y el enlace de pago. */
  function flowLink(value) {
    try {
      const url = new URL(String(value || ""));
      const host = url.hostname.toLowerCase();
      return url.protocol === "https:" && (host === "flow.cl" || host.endsWith(".flow.cl")) ? url.href : "";
    } catch {
      return "";
    }
  }

  /**
   * El estado del plan, en una etiqueta y una frase. Las fechas de Flow son el día en que algo cambia: la prueba
   * termina y se cobra ese mismo día, y una cancelación deja el plan hasta ese día.
   */
  function subscriptionState(subscription, plan) {
    const end = subscription.current_period_end;
    const pastDue = isPastDue(subscription);
    const pay = pastDue ? flowLink(subscription.payment_link) : "";
    if (isComp(subscription)) {
      const date = formatLongDate(end);
      return { label: "Cortesía", text: date ? `Cortesía hasta el ${date}.` : "Cortesía vigente.", pay: "" };
    }
    if (subscription.cancel_at_period_end) {
      const date = formatLongDate(end);
      return { label: "No se renueva", text: date ? `Termina el ${date}.` : "Termina al cierre del período.", pay };
    }
    if (subscription.status === "trialing") {
      const date = formatLongDate(subscription.trial_ends_at || end);
      const price = priceOf(plan);
      const charge = price === null ? "ese día se hace el primer cobro" : `ese día se cobran ${pesos(price)}`;
      return { label: "En prueba", text: date ? `En prueba hasta el ${date}; ${charge}.` : "En prueba.", pay };
    }
    if (subscription.status === "active" && !pastDue) {
      const date = formatLongDate(subscription.next_invoice_at || end);
      return { label: "Activa", text: date ? `Próximo cobro: ${date}.` : "", pay };
    }
    if (pastDue) {
      const text = pay
        ? "Hay un cobro sin pagar. Págalo en Flow para seguir con la IA incluida."
        : `Hay un cobro sin pagar. Si no te llegó el enlace de pago de Flow, escríbenos a ${CONTACT}.`;
      return { label: "Pago pendiente", text, pay };
    }
    if (subscription.status === "incomplete") return { label: "Pendiente", text: "Flow todavía no confirma este plan.", pay };
    return { label: subscription.status === "paused" ? "Pausada" : String(subscription.status || ""), text: "", pay };
  }

  function usedLine(used, limit, renews) {
    const amount = limit === null ? `${number.format(used)} unidades` : `${number.format(used)} de ${number.format(limit)} unidades`;
    return `Usada: ${amount}${renews ? ` · ${renews}` : ""}`;
  }

  /**
   * El uso de la IA incluida del período. `usage` es el período más reciente con uso (/api/account). Si ya terminó y la
   * suscripción espera su cobro, el gateway sigue contando en él, porque la cuota se renueva con el cobro; si en cambio
   * empezó otro período, ése no tiene fila hasta que se usa y lo usado es cero.
   */
  function usageState(usage, subscription, plan, now) {
    if (!["trialing", "active", "past_due"].includes(subscription?.status)) return null;
    const comp = isComp(subscription);
    const paidThrough = instant(subscription.current_period_end);
    const waiting = !comp && (paidThrough === null || paidThrough <= now);
    const usageEnd = instant(usage?.periodEnd);
    let used = 0;
    let limit;
    let renews;
    if (usage && usageEnd !== null && usageEnd > now) {
      [used, limit, renews] = [usage.unitsUsed, usage.unitsLimit, `se renueva el ${formatLongDate(usageEnd)}`];
    } else if (usage && waiting) {
      [used, limit, renews] = [usage.unitsUsed, usage.unitsLimit, "se renueva con tu próximo cobro"];
    } else {
      limit = periodLimit(plan, subscription.status === "trialing");
      if (limit === null) return { line: "Todavía no usas la IA incluida en este período.", exhausted: false };
      renews = waiting ? "se renueva con tu próximo cobro" : comp ? "" : `se renueva el ${formatLongDate(paidThrough)}`;
    }
    used = Math.max(0, Number(used) || 0);
    limit = limit == null || !Number.isFinite(Number(limit)) ? null : Number(limit);
    return { line: usedLine(used, limit, renews), exhausted: limit !== null && used >= limit };
  }

  /**
   * El resumen antes de ir a Flow: el plan, el precio con IVA y cuándo se cobra. null si el plan no se puede contratar
   * (fuera de venta o sin precio en el catálogo, que es lo que cobra el checkout). Sin un `trialEligible` explícito no
   * se promete prueba, y sin versión de los Términos no se puede aceptar nada.
   */
  function checkoutSummary(planId, account, now) {
    const plan = catalogPlan(account, planId);
    const price = priceOf(plan);
    if (!plan || plan.for_sale !== true || price === null) return null;
    const catalogTrial = Math.max(0, Math.floor(Number(plan.trial_period_days) || 0));
    const trialDays = account.trialEligible === true ? catalogTrial : 0;
    const rows = [];
    if (trialDays > 0) {
      const firstCharge = calendarDate.format(chileDay(now) + trialDays * DAY);
      rows.push(["Hoy", `No se cobra nada. Empiezan ${trialDays} días de prueba.`]);
      rows.push(["Primer cobro", `${pesos(price)} el ${firstCharge}, si no cancelas antes; luego cada mes, hasta que canceles.`]);
    } else {
      rows.push(["Primer cobro", `${pesos(price)} al contratar; luego cada mes, hasta que canceles.`]);
      if (catalogTrial > 0) rows.push(["Prueba", "Ya usaste la prueba gratis: es una por persona."]);
    }
    const limit = periodLimit(plan, false);
    if (limit !== null) {
      const trialLimit = trialDays > 0 ? periodLimit(plan, true) : null;
      const during = trialLimit === null ? "" : ` (${number.format(trialLimit)} durante la prueba)`;
      rows.push(["IA incluida", `${number.format(limit)} unidades por período${during}. Se renueva con tu cobro.`]);
    }
    rows.push(["Cancelar", "Desde esta página, cuando quieras."]);
    // Ley 19.496, art. 12 A: antes de pagar se le dice dónde llegará la confirmación escrita. Sin correo conocido se
    // nombra «el correo de tu cuenta» en lugar de inventar uno.
    const email = String(account.user?.email || "").trim();
    return {
      plan: planId,
      name: planName(planId),
      price: `${pesos(price)} al mes, IVA incluido`,
      rows,
      confirmation: `Te enviaremos la confirmación de la compra y una copia de los Términos ${email ? `a ${email}` : "al correo de tu cuenta"}.`,
      trialDays,
      termsVersion: TERMS_VERSION.test(String(account.termsVersion || "")) ? account.termsVersion : null,
    };
  }

  /** Lo que recibe /api/billing/checkout: el plan y la versión de los Términos que se aceptó. */
  function checkoutBody(summary) {
    return { plan: summary.plan, acceptedTerms: true, termsVersion: summary.termsVersion };
  }

  const BILLING_ERRORS = {
    subscription_exists: "Ya tienes un plan en curso: no se creó otro.",
    customer_mismatch: "El registro de tarjeta no corresponde a esta cuenta. No se creó ningún plan; vuelve a intentarlo desde aquí.",
    checkout_failed: "Ese registro de tarjeta no se pudo completar. Vuelve a elegir el plan para intentarlo de nuevo.",
    subscription_failed: `Flow registró tu tarjeta, pero no pudimos guardar el plan y pedimos a Flow anularlo. Si ves algún cobro, escríbenos a ${CONTACT}.`,
    invalid_callback: "El retorno de Flow llegó incompleto. Vuelve a elegir el plan para intentarlo de nuevo.",
  };

  /**
   * El aviso del retorno de Flow (/cuenta?billing=…&code=…). El código viene en la URL, que cualquiera puede armar:
   * sólo se muestra si tiene la forma de un código, nunca como texto libre.
   */
  function billingMessage(billing, code) {
    if (billing === "success") return { text: "Listo: tu plan quedó registrado.", tone: "success" };
    if (billing === "cancelled") return { text: "El registro de tarjeta se canceló. No se creó ningún plan.", tone: "" };
    if (billing === "processing") return { text: "Flow todavía está confirmando tu tarjeta. Revisa esta página en unos minutos.", tone: "" };
    if (billing === "expired") return { text: "El registro de tarjeta venció antes de terminar. Si tu plan no aparece aquí, vuelve a elegirlo.", tone: "error" };
    if (billing !== "error") return null;
    const known = /^[a-z0-9_]{1,40}$/.test(String(code || "")) ? code : "";
    const text = BILLING_ERRORS[known] || `No pudimos completar el registro con Flow. Puedes intentarlo de nuevo; si se repite, escríbenos a ${CONTACT}.`;
    return { text: known ? `${text} (código: ${known})` : text, tone: "error" };
  }

  // Lo guardado en el navegador lleva su vencimiento. localStorage puede no existir o lanzar (navegación privada
  // estricta, almacenamiento bloqueado): entonces el valor dura lo que dura la página.
  function browserStorage() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  function remember(storage, key, value, ttl, now) {
    try {
      storage?.setItem(key, JSON.stringify({ value, expiresAt: now + ttl }));
    } catch {
      // Sin almacenamiento no queda nada que limpiar
    }
  }

  function forget(storage, key) {
    try {
      storage?.removeItem(key);
    } catch {
      // Sin almacenamiento no queda nada que limpiar
    }
  }

  /** Un valor guardado y vigente; lo vencido, ilegible o sin vencimiento se borra. */
  function recall(storage, key, now) {
    let saved = null;
    try {
      saved = JSON.parse(storage?.getItem(key) || "null");
    } catch {
      saved = null;
    }
    if (saved && typeof saved.value === "string" && Number(saved.expiresAt) > now) return saved;
    forget(storage, key);
    return null;
  }

  /**
   * La activación pendiente: la de la URL (?activate=, que abre la app) o la guardada, si no ha vencido. Guardarla es
   * lo que la deja pasar el enlace mágico y el viaje a Flow. Volver a abrir el mismo enlace no alarga su vencimiento.
   */
  function pendingActivationFrom(url, storage, now) {
    const saved = recall(storage, PENDING_ACTIVATION_KEY, now);
    const code = url.searchParams.get("activate");
    if (code && /^[a-f0-9]{32,128}$/i.test(code)) {
      if (saved?.value === code) return { code, expiresAt: saved.expiresAt };
      remember(storage, PENDING_ACTIVATION_KEY, code, ACTIVATION_TTL, now);
      return { code, expiresAt: now + ACTIVATION_TTL };
    }
    return saved ? { code: saved.value, expiresAt: saved.expiresAt } : null;
  }

  window.pteronCuenta = {
    formatDate,
    formatLongDate,
    chileDay,
    periodLimit,
    currentSubscription,
    flowLink,
    subscriptionState,
    usageState,
    checkoutSummary,
    checkoutBody,
    billingMessage,
    remember,
    recall,
    pendingActivationFrom,
  };

  /* ---------- La página ---------- */
  const authPanel = document.querySelector("[data-auth-panel]");
  const dashboard = document.querySelector("[data-dashboard]");
  if (!authPanel || !dashboard) return;

  const storage = browserStorage();
  const notice = document.querySelector("[data-account-notice]");
  const noticeText = notice?.querySelector("[data-account-notice-text]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const linkSent = document.querySelector("[data-link-sent]");
  const summaryPanel = document.querySelector("[data-checkout-summary]");
  const summaryForm = summaryPanel?.querySelector("[data-summary-form]");
  const termsAccept = summaryPanel?.querySelector("[data-terms-accept]");
  const summaryConfirm = summaryPanel?.querySelector("[data-checkout-confirm]");
  const ACTIVATION_EXPIRED = "La autorización que pidió tu equipo venció. En pteron, vuelve a elegir «Activar este equipo».";
  const CONFIRM_LABEL = "Registrar tarjeta en Flow";

  const pageUrl = new URL(window.location.href);
  let pendingActivation = pendingActivationFrom(pageUrl, storage, Date.now());
  let activationExpired = false;
  const requestedPlan = readRequestedPlan();
  let requestedPlanShown = false;
  let billingReturn = billingMessage(pageUrl.searchParams.get("billing"), pageUrl.searchParams.get("code"));
  const billingSucceeded = pageUrl.searchParams.get("billing") === "success";
  // El código de activación y el aviso de Flow no se quedan en la URL: recargar no los repite y no viajan al compartirla
  if (["activate", "billing", "code"].some((key) => pageUrl.searchParams.has(key))) {
    ["activate", "billing", "code"].forEach((key) => pageUrl.searchParams.delete(key));
    window.history.replaceState({}, "", `${pageUrl.pathname}${pageUrl.search}${window.location.hash}`);
  }
  let memorySession = null;
  let account = null;
  let summaryPlan = "";

  function readRequestedPlan() {
    const plan = pageUrl.searchParams.get("plan");
    if (PLAN_IDS.includes(plan)) {
      remember(storage, REQUESTED_PLAN_KEY, plan, REQUESTED_PLAN_TTL, Date.now());
      return plan;
    }
    const saved = recall(storage, REQUESTED_PLAN_KEY, Date.now())?.value;
    return PLAN_IDS.includes(saved) ? saved : "";
  }

  /** El código de activación vigente; si venció, se olvida y la página lo dice una vez. */
  function activationCode() {
    if (!pendingActivation) return "";
    if (pendingActivation.expiresAt > Date.now()) return pendingActivation.code;
    dropActivation();
    activationExpired = true;
    return "";
  }

  function dropActivation() {
    pendingActivation = null;
    forget(storage, PENDING_ACTIVATION_KEY);
  }

  function loadSession() {
    try {
      const value = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
      if (value?.access_token && value?.refresh_token) return value;
    } catch {
      // Una sesión ilegible es como no tenerla
    }
    return memorySession;
  }

  function saveSession(value) {
    if (!value?.access_token || !value?.refresh_token) return;
    try {
      if (!storage) throw new Error("sin almacenamiento");
      storage.setItem(SESSION_KEY, JSON.stringify(value));
      memorySession = null;
    } catch {
      // Sin almacenamiento la sesión dura lo que la página
      memorySession = value;
    }
  }

  function clearSession() {
    memorySession = null;
    [SESSION_KEY, PENDING_ACTIVATION_KEY, REQUESTED_PLAN_KEY].forEach((key) => forget(storage, key));
    window.location.reload();
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
    (noticeText || notice).textContent = message || "";
    notice.dataset.tone = tone;
    notice.hidden = !message;
  }
  notice?.querySelector("[data-account-notice-close]")?.addEventListener("click", () => {
    notice.hidden = true;
  });
  // Hasta 820 px el aviso va abajo y tapa el final de la ventana: con su alto (0 mientras está oculto), cuenta.css
  // aparta de él lo que recibe el foco y alarga el colofón para que sus últimos enlaces queden a la vista
  if (notice && "ResizeObserver" in window) {
    new window.ResizeObserver(() => document.documentElement.style.setProperty("--aviso-alto", `${notice.offsetHeight}px`)).observe(notice);
  }

  function showLoginMessage(message) {
    if (loginMessage) loginMessage.textContent = message || "";
  }

  function setDashboardVisible(isVisible) {
    authPanel.hidden = isVisible;
    dashboard.hidden = !isVisible;
  }

  const scrollBehavior = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderIdentity(data) {
    const email = data?.user?.email || "";
    const displayName = String(data?.profile?.display_name || "").trim() || "profe";
    document.querySelector("[data-account-email]").textContent = email;
    document.querySelector("[data-display-name]").textContent = displayName;
  }

  // El precio, la prueba y la cuota viven en `plan_catalog`. El HTML trae los valores publicados como respaldo: si el
  // catálogo no responde o trae un valor que no es un número válido, la tarjeta se queda con lo que ya mostraba en
  // lugar de enseñar un precio en blanco o inventado.
  function renderPlanCatalog(data, current) {
    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      const plan = catalogPlan(data, card.dataset.planCard);
      if (!plan) return;
      const price = priceOf(plan);
      const priceNode = card.querySelector("[data-plan-price]");
      if (priceNode && price !== null) priceNode.textContent = pesos(price);
      const days = Math.max(0, Math.floor(Number(plan.trial_period_days) || 0));
      const trialNode = card.querySelector("[data-plan-trial]");
      // En la tarjeta del plan en curso la prueba ya no se ofrece: su estado está en «Plan actual»
      if (trialNode) trialNode.hidden = current?.plan_id === plan.id;
      if (trialNode && days > 0 && price !== null && data.trialEligible === true) {
        trialNode.replaceChildren(element("span", `${days} días gratis.`, "destacado"), ` Luego ${pesos(price)} al mes, hasta que canceles.`);
      } else if (trialNode && days > 0 && data.trialEligible === false) {
        trialNode.replaceChildren("Ya usaste tu prueba gratis: el primer cobro es al contratar.");
      }
      const quotaNode = card.querySelector("[data-plan-quota]");
      const limit = periodLimit(plan, false);
      if (quotaNode && limit !== null) {
        const trialLimit = days > 0 && data.trialEligible === true ? periodLimit(plan, true) : null;
        const during = trialLimit === null ? "" : ` (${number.format(trialLimit)} durante la prueba)`;
        quotaNode.textContent = `IA incluida: ${number.format(limit)} unidades por período${during}.`;
      }
    });
  }

  // Un plan se elige sólo si está a la venta (for_sale) y no hay otro en curso: el checkout negaría ambos casos, y un
  // botón que no lleva a ninguna parte no se ofrece.
  function renderPlans(data) {
    const now = Date.now();
    const current = currentSubscription(data, now);
    renderPlanCatalog(data, current);
    document.querySelectorAll("[data-plan-card]").forEach((card) => {
      const id = card.dataset.planCard;
      const isCurrent = current?.plan_id === id;
      const forSale = Boolean(checkoutSummary(id, data, now));
      card.dataset.current = String(isCurrent);
      const button = card.querySelector("[data-checkout-plan]");
      if (!button) return;
      button.disabled = isCurrent || Boolean(current) || !forSale;
      button.textContent = isCurrent ? "Plan actual" : forSale ? `Elegir ${planName(id)}` : "Disponible pronto";
    });
    const busy = document.querySelector("[data-plan-busy]");
    if (busy) busy.hidden = !current;
    if (requestedPlan && !requestedPlanShown) {
      requestedPlanShown = true;
      forget(storage, REQUESTED_PLAN_KEY);
      const card = document.querySelector(`[data-plan-card="${requestedPlan}"]`);
      card?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      const button = card?.querySelector("[data-checkout-plan]");
      if (button && !button.disabled) window.setTimeout(() => button.focus({ preventScroll: true }), 250);
    }
  }

  function renderSubscription(data) {
    const now = Date.now();
    const current = currentSubscription(data, now);
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
    const plan = catalogPlan(data, current.plan_id);
    const state = subscriptionState(current, plan);
    const heading = element("div", "", "subscription-plan");
    heading.append(element("strong", planName(current.plan_id)), element("span", state.label));
    const parts = [heading];
    if (state.text) parts.push(element("p", state.text, "subscription-estado"));
    if (state.pay) {
      const pay = element("a", "Pagar en Flow", "boton boton-principal");
      pay.href = state.pay;
      parts.push(pay);
    }
    const usage = usageState(data.usage, current, plan, now);
    if (usage) {
      const box = element("div", "", "subscription-uso");
      box.append(element("p", "IA incluida de este período", "rotulo"), element("p", usage.line));
      if (usage.exhausted) box.append(element("p", "Se agotó. Mientras tanto, sigues con el modelo local o con tu propia clave.", "nota"));
      parts.push(box);
    }
    summary.replaceChildren(...parts);
    // Cancelar es de Flow: una cortesía no se cancela aquí, y una ya cancelada no se vuelve a cancelar
    cancel.hidden = isComp(current) || current.cancel_at_period_end || !["trialing", "active", "past_due"].includes(current.status);
    cancel.disabled = false;
  }

  function licenseState(license, now) {
    const expires = instant(license.expires_at);
    if (license.status === "revoked") return ["Revocada", "off"];
    if (license.status !== "active" || (expires !== null && expires <= now)) return ["Vencida", "off"];
    return ["Vigente", "ok"];
  }

  function renderLicenses(data) {
    const list = document.querySelector("[data-license-list]");
    if (!data.licenses?.length) {
      list.replaceChildren(element("p", "Todavía no hay licencias emitidas.", "account-muted"));
      return;
    }
    const now = Date.now();
    list.replaceChildren(...data.licenses.map((license) => {
      const row = element("div", "", "license-row");
      const copy = document.createElement("div");
      copy.append(
        element("strong", `${planName(license.plan_id)} · licencia local`),
        element("span", `Emitida ${formatDate(license.issued_at)} · vence ${formatDate(license.expires_at)}`),
      );
      const [label, tone] = licenseState(license, now);
      const state = element("span", label, "license-row-status");
      state.dataset.estado = tone;
      row.append(copy, state);
      return row;
    }));
  }

  function renderActivation() {
    const code = activationCode();
    document.querySelector("[data-activation-pending]").hidden = !code;
    document.querySelector("[data-activation-idle]").hidden = Boolean(code);
    document.querySelector("[data-activation-result]").hidden = true;
    document.querySelector("[data-open-app]").removeAttribute("href");
    // La licencia sale del plan: sin uno, autorizar el equipo no le da nada que guardar
    const withoutPlan = !currentSubscription(account, Date.now());
    document.querySelector("[data-activation-has-plan]")?.toggleAttribute("hidden", withoutPlan);
    document.querySelector("[data-activation-needs-plan]")?.toggleAttribute("hidden", !withoutPlan);
  }

  /** El aviso con que abre el panel: el retorno de Flow primero, después lo que espera la activación. */
  function accountNotice(data) {
    const code = activationCode();
    const waiting = code ? " Falta autorizar el equipo que pidió la activación, en «Activar pteron»." : "";
    if (billingReturn) {
      const message = billingReturn;
      billingReturn = null;
      const current = billingSucceeded ? currentSubscription(data, Date.now()) : null;
      if (current) {
        const state = subscriptionState(current, catalogPlan(data, current.plan_id));
        return [`Listo: ${planName(current.plan_id)} quedó contratado. ${state.text}${waiting}`.trim(), "success"];
      }
      if (billingSucceeded) return [`Tu plan quedó registrado. Si no aparece aquí en unos minutos, escríbenos a ${CONTACT}.${waiting}`, "success"];
      return [`${message.text}${waiting}`, message.tone];
    }
    if (activationExpired) {
      activationExpired = false;
      return [ACTIVATION_EXPIRED, "error"];
    }
    if (code) return ["Este equipo está listo para ser autorizado. Revisa la sección «Activar pteron».", "success"];
    if (requestedPlan && !currentSubscription(data, Date.now()) && !checkoutSummary(requestedPlan, data, Date.now())) {
      return [`${planName(requestedPlan)} todavía no está a la venta.`, ""];
    }
    return ["", ""];
  }

  async function loadAccount() {
    try {
      account = await api("/api/account");
      setDashboardVisible(true);
      hideSummary();
      renderIdentity(account);
      renderPlans(account);
      renderSubscription(account);
      renderLicenses(account);
      renderActivation();
      showNotice(...accountNotice(account));
      return true;
    } catch (error) {
      // Sin cuenta que mostrar, la página vuelve al formulario de entrada (no al esqueleto)
      document.documentElement.classList.remove("has-session");
      setDashboardVisible(false);
      if (error.status === 401) {
        showNotice("Tu sesión expiró. Solicita un nuevo enlace para entrar.", "error");
        return false;
      }
      showNotice(error.message, "error");
      return false;
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    const input = loginForm.querySelector("#account-email");
    const button = loginForm.querySelector("button");
    showLoginMessage("");
    input.removeAttribute("aria-invalid");
    button.disabled = true;
    // El botón deshabilitado suelta el foco: al responder, va al aviso de envío (que así se lee) o de vuelta al campo
    try {
      await api("/api/auth/request-magic-link", {
        method: "POST",
        body: JSON.stringify({ email: input.value }),
      });
      linkSent.hidden = false;
      showLoginMessage("");
      linkSent.focus();
    } catch (error) {
      showLoginMessage(error.message);
      // Un 400 es el correo que no sirve; una caída del servicio no lo hace inválido
      if (error.status === 400) input.setAttribute("aria-invalid", "true");
      input.focus();
    } finally {
      button.disabled = false;
    }
  }

  /* El resumen antes de Flow: qué se contrata, cuánto y cuándo se cobra, y la aceptación de los Términos vigentes. */
  function setSummaryError(message) {
    const error = summaryPanel.querySelector("[data-summary-error]");
    error.textContent = message || "";
  }

  function hideSummary() {
    if (!summaryPanel) return;
    summaryPanel.hidden = true;
    summaryPlan = "";
  }

  function openSummary(plan) {
    const summary = account && checkoutSummary(plan, account, Date.now());
    if (!summaryPanel || !summary) {
      showNotice(`${planName(plan)} todavía no está a la venta.`, "error");
      if (account) renderPlans(account);
      return;
    }
    summaryPlan = plan;
    summaryPanel.querySelector("[data-summary-title]").textContent = summary.name;
    summaryPanel.querySelector("[data-summary-price]").textContent = summary.price;
    summaryPanel.querySelector("[data-summary-rows]").replaceChildren(...summary.rows.map(([label, text]) => {
      const row = document.createElement("div");
      row.append(element("dt", label), element("dd", text));
      return row;
    }));
    summaryPanel.querySelector("[data-summary-confirmation]").textContent = summary.confirmation;
    summaryPanel.querySelector("[data-terms-version]").textContent = summary.termsVersion || "vigente";
    termsAccept.checked = false;
    termsAccept.removeAttribute("aria-invalid");
    summaryConfirm.disabled = !summary.termsVersion;
    summaryConfirm.textContent = CONFIRM_LABEL;
    setSummaryError(summary.termsVersion ? "" : "No pudimos cargar la versión vigente de los Términos. Recarga la página.");
    summaryPanel.hidden = false;
    summaryPanel.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    summaryPanel.querySelector("[data-summary-title]").focus({ preventScroll: true });
  }

  function closeSummary() {
    const plan = summaryPlan;
    hideSummary();
    document.querySelector(`[data-checkout-plan="${plan}"]`)?.focus();
  }

  async function confirmCheckout(event) {
    event.preventDefault();
    const summary = account && checkoutSummary(summaryPlan, account, Date.now());
    if (!summary?.termsVersion) {
      setSummaryError("No pudimos cargar la versión vigente de los Términos. Recarga la página.");
      return;
    }
    if (!termsAccept.checked) {
      termsAccept.setAttribute("aria-invalid", "true");
      setSummaryError("Para seguir, marca que leíste y aceptas los Términos y la Política de privacidad.");
      termsAccept.focus();
      return;
    }
    termsAccept.removeAttribute("aria-invalid");
    setSummaryError("");
    summaryConfirm.disabled = true;
    summaryConfirm.textContent = "Abriendo Flow…";
    showNotice("Estamos preparando el registro seguro de tu tarjeta con Flow…");
    try {
      const result = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify(checkoutBody(summary)),
      });
      const redirect = flowLink(result?.redirectUrl);
      if (!redirect) throw new Error("El enlace de pago no es válido.");
      window.location.assign(redirect);
    } catch (error) {
      summaryConfirm.disabled = false;
      summaryConfirm.textContent = CONFIRM_LABEL;
      // Los Términos cambiaron con la página abierta: lo aceptado ya no es la versión vigente
      const message = error.code === "terms_required"
        ? "Los Términos cambiaron mientras tenías la página abierta. Recarga la página y vuelve a aceptarlos."
        : error.message;
      if (error.code === "plan_not_for_sale" || error.code === "subscription_exists") {
        if (await loadAccount()) showNotice(message, "error");
        return;
      }
      setSummaryError(message);
      showNotice(message, "error");
      // El botón deshabilitado soltó el foco: vuelve a él, para intentarlo de nuevo
      summaryConfirm.focus();
    }
  }

  async function cancelSubscription() {
    const current = currentSubscription(account, Date.now());
    if (!current) return;
    const name = planName(current.plan_id);
    const trial = current.status === "trialing";
    const end = formatLongDate(trial ? current.trial_ends_at || current.current_period_end : current.current_period_end);
    const question = trial
      ? `Si cancelas durante la prueba no se cobra nada, y ${name} termina ${end ? `el ${end}` : "al cerrar la prueba"}. ¿Cancelar ${name}?`
      : `${name} termina ${end ? `el ${end}` : "al cierre del período pagado"} y no se renueva. ¿Cancelar la renovación?`;
    if (!window.confirm(question)) return;
    const button = document.querySelector("[data-cancel-subscription]");
    button.disabled = true;
    try {
      const result = await api("/api/billing/cancel", { method: "POST", body: "{}" });
      const until = formatLongDate(result?.cancelAt);
      if (await loadAccount()) showNotice(until ? `Renovación cancelada. ${name} termina el ${until}.` : "Renovación cancelada.", "success");
    } catch (error) {
      showNotice(error.message, "error");
      button.disabled = false;
      button.focus();
    }
  }

  async function confirmActivation() {
    const code = activationCode();
    const button = document.querySelector("[data-confirm-activation]");
    if (!code) {
      renderActivation();
      showNotice(ACTIVATION_EXPIRED, "error");
      activationExpired = false;
      return;
    }
    button.disabled = true;
    showNotice("Estamos autorizando este equipo…");
    try {
      const result = await api("/api/activation/complete", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const openApp = document.querySelector("[data-open-app]");
      if (/^pteron:\/\//.test(result?.deepLink || "")) openApp.href = result.deepLink;
      document.querySelector("[data-activation-pending]").hidden = true;
      document.querySelector("[data-activation-idle]").hidden = true;
      document.querySelector("[data-activation-result]").hidden = false;
      dropActivation();
      showNotice("Equipo autorizado. Abre pteron para guardar la licencia.", "success");
      // El botón se ocultó con el foco encima: el foco pasa a lo que sigue, abrir pteron
      openApp.focus();
    } catch (error) {
      button.disabled = false;
      if (error.status === 410) {
        // Venció o ya se usó en el servidor: guardarla más tiempo no la recupera
        dropActivation();
        renderActivation();
        showNotice(ACTIVATION_EXPIRED, "error");
        return;
      }
      showNotice(error.message, "error");
      button.focus();
    }
  }

  loginForm?.addEventListener("submit", sendMagicLink);
  document.querySelector("[data-sign-out]")?.addEventListener("click", clearSession);
  document.querySelectorAll("[data-checkout-plan]").forEach((button) => {
    button.addEventListener("click", () => openSummary(button.dataset.checkoutPlan));
  });
  summaryForm?.addEventListener("submit", confirmCheckout);
  summaryPanel?.querySelector("[data-checkout-back]")?.addEventListener("click", closeSummary);
  termsAccept?.addEventListener("change", () => {
    if (!termsAccept.checked) return;
    termsAccept.removeAttribute("aria-invalid");
    setSummaryError("");
  });
  document.querySelector("[data-cancel-subscription]")?.addEventListener("click", cancelSubscription);
  document.querySelector("[data-confirm-activation]")?.addEventListener("click", confirmActivation);
  // Al volver con «Atrás» desde Flow la página puede salir de la caché tal como quedó: el botón vuelve a estar disponible
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !summaryConfirm) return;
    summaryConfirm.disabled = false;
    summaryConfirm.textContent = CONFIRM_LABEL;
    showNotice("");
  });

  consumeAuthHash();
  if (billingReturn) showNotice(billingReturn.text, billingReturn.tone);
  if (loadSession()) loadAccount();
  else {
    // Sin una sesión que se pueda usar (un enlace incompleto, por ejemplo), nada que esperar: vuelve el formulario
    document.documentElement.classList.remove("has-session");
    setDashboardVisible(false);
    if (billingReturn) return;
    if (activationCode()) {
      showNotice("Inicia sesión para autorizar el equipo que solicitó activación.");
    } else if (activationExpired) {
      activationExpired = false;
      showNotice(ACTIVATION_EXPIRED, "error");
    } else if (requestedPlan) {
      showNotice(`Inicia sesión para elegir el plan ${planName(requestedPlan)}.`);
    }
  }
})();
