/* Administración de pteron: cuentas, cortesías, consumo y cuota. Sólo DOM, sin HTML inyectado. */
(() => {
  const SESSION_KEY = "pteron-account-session";
  const $ = (selector, root = document) => root.querySelector(selector);
  const notice = $("[data-admin-notice]");
  const login = $("[data-admin-login]");
  const app = $("[data-admin-app]");

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return value?.access_token && value?.refresh_token ? value : null;
    } catch {
      return null;
    }
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

  async function refreshSession() {
    const current = loadSession();
    if (!current?.refresh_token) throw new Error("Tu sesión ya no está disponible.");
    const response = await fetch("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: current.refresh_token }) });
    const data = await readResponse(response);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...data, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 }));
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

  function show(message, tone = "") {
    if (!notice) return;
    notice.textContent = message || "";
    notice.dataset.tone = tone;
    notice.hidden = !message;
  }

  const clp = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("es-CL");
  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(date);
  };
  const fmtDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
  };
  const estado = (s) => ({ trialing: "En prueba", active: "Activa", past_due: "Pago pendiente", paused: "Pausada", canceled: "Cancelada", expired: "Terminada", incomplete: "Pendiente" }[s] || s || "—");
  const planLabel = (row) => (row ? `${row.plan_id}${row.provider === "comp" ? " · cortesía" : ""}` : "núcleo local");

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value !== null && value !== undefined) node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child !== null && child !== undefined) node.append(child);
    return node;
  };
  const cell = (content, cls) => el("td", cls ? { class: cls } : {}, typeof content === "string" || typeof content === "number" ? String(content) : content);
  const fillTable = (table, rows, build) => {
    const tbody = table.querySelector("tbody");
    tbody.replaceChildren(...rows.map(build));
    if (!rows.length) tbody.append(el("tr", {}, el("td", { colspan: String(table.querySelectorAll("th").length), class: "muted", text: "Sin datos." })));
  };
  const stat = (label, value, small) => el("div", { class: "stat" }, [el("span", { text: label }), el("strong", { text: value }), small ? el("small", { text: small }) : null]);

  // Pestañas por fragmento (#cuentas) para poder enlazar y volver atrás.
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const views = [...document.querySelectorAll("[data-view]")];
  const loaded = new Set();
  const loaders = { resumen: loadResumen, cuentas: loadCuentas, consumo: loadConsumo, planes: loadPlanes };
  function showTab(name, push = true) {
    const target = loaders[name] ? name : "resumen";
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.tab === target)));
    views.forEach((view) => { view.hidden = view.dataset.view !== target; });
    if (push && location.hash !== `#${target}`) history.pushState({}, "", `#${target}`);
    if (!loaded.has(target)) {
      loaded.add(target);
      loaders[target]().catch(fail);
    }
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
  window.addEventListener("popstate", () => showTab(location.hash.replace("#", "") || "resumen", false));

  function fail(error) {
    if (error.status === 401) {
      app.hidden = true;
      login.hidden = false;
      show("Tu sesión expiró. Entra de nuevo desde tu cuenta.", "error");
      return;
    }
    show(error.message || "No pudimos completar la solicitud.", "error");
  }

  async function loadResumen() {
    const [resumen, cuentas] = await Promise.all([api("/api/admin/resumen"), api("/api/admin/cuentas")]);
    $("[data-resumen-stats]").replaceChildren(
      stat("Cuentas", num.format(resumen.cuentas)),
      stat("Pagando", num.format(resumen.pagando), `${num.format(resumen.en_prueba)} en prueba`),
      stat("Cortesías", num.format(resumen.cortesias)),
      stat("CLP / mes recurrente", `$${clp.format(resumen.clp_mes_recurrente)}`),
      stat(`Tokens ${resumen.mes}`, num.format(resumen.tokens_mes), `${num.format(resumen.cuentas_con_uso)} cuentas con uso`),
      stat("Licencias vigentes", num.format(resumen.licencias_vigentes)),
    );
    fillTable($("[data-resumen-recientes]"), cuentas.cuentas.slice(0, 8), (row) => el("tr", {}, [
      cell(el("button", { class: "button-link", type: "button", text: row.email || row.id, onclick: () => openCuenta(row.id) })),
      cell(fmtDate(row.created_at)),
      cell(planLabel(row.suscripcion)),
      cell(row.suscripcion ? estado(row.suscripcion.status) : "—"),
    ]));
  }

  async function loadCuentas(q = "") {
    const data = await api(`/api/admin/cuentas${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    $("[data-cuentas-total]").textContent = `${num.format(data.total)} cuenta${data.total === 1 ? "" : "s"} · tokens de ${data.mes}`;
    fillTable($("[data-cuentas-tabla]"), data.cuentas, (row) => el("tr", {}, [
      cell(row.email || row.id),
      cell(fmtDate(row.created_at)),
      cell(planLabel(row.suscripcion)),
      cell(row.suscripcion ? estado(row.suscripcion.status) : "—"),
      cell(row.suscripcion ? fmtDate(row.suscripcion.status === "trialing" ? row.suscripcion.trial_ends_at : row.suscripcion.current_period_end) : "—"),
      cell(row.licencia ? `${row.licencia.plan_id} · vence ${fmtDate(row.licencia.expires_at)}` : "—"),
      cell(row.consumo_mes ? num.format(row.consumo_mes.ai_units_used) : "0", "num"),
      cell(el("button", { class: "button button-small button-outline", type: "button", text: "Ver", onclick: () => openCuenta(row.id) })),
    ]));
  }
  $("[data-cuentas-buscar]").addEventListener("submit", (event) => {
    event.preventDefault();
    loadCuentas(new FormData(event.currentTarget).get("q") || "").catch(fail);
  });

  async function openCuenta(id) {
    showTab("cuentas");
    const lista = $("[data-cuentas-lista]");
    const detalle = $("[data-cuenta-detalle]");
    lista.hidden = true;
    detalle.hidden = false;
    detalle.replaceChildren(el("p", { class: "muted", text: "Cargando…" }));
    try {
      const data = await api(`/api/admin/cuentas/${encodeURIComponent(id)}`);
      renderCuenta(data);
    } catch (error) {
      fail(error);
      closeCuenta();
    }
  }
  function closeCuenta() {
    $("[data-cuentas-lista]").hidden = false;
    $("[data-cuenta-detalle]").hidden = true;
    loadCuentas($("#admin-q").value || "").catch(fail);
  }

  function renderCuenta(data) {
    const { cuenta, suscripciones, licencias, activaciones, consumo, eventos, cobros } = data;
    const actual = suscripciones.find((row) => ["incomplete", "trialing", "active", "past_due", "paused"].includes(row.status));
    const detalle = $("[data-cuenta-detalle]");

    const form = el("form", { class: "toolbar", onsubmit: async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      try {
        await api(`/api/admin/cuentas/${encodeURIComponent(cuenta.id)}/cortesia`, { method: "POST", body: JSON.stringify({ plan: fd.get("plan"), meses: Number(fd.get("meses")) }) });
        show(`Cortesía ${fd.get("plan")} concedida a ${cuenta.email} por ${fd.get("meses")} meses.`, "success");
        openCuenta(cuenta.id);
      } catch (error) { fail(error); }
    } }, [
      el("div", { class: "field" }, [el("label", { for: "cortesia-plan", text: "Plan de cortesía" }), el("select", { id: "cortesia-plan", name: "plan" }, [el("option", { value: "tester", text: "tester" }), el("option", { value: "basic", text: "basic" }), el("option", { value: "pro", text: "pro" })])]),
      el("div", { class: "field", style: "flex: 0 0 120px" }, [el("label", { for: "cortesia-meses", text: "Meses" }), el("input", { id: "cortesia-meses", name: "meses", type: "number", min: "1", max: "36", value: "12", required: "" })]),
      el("button", { class: "button", type: "submit", text: actual ? "Reemplazar por cortesía" : "Dar cortesía" }),
    ]);
    const quitar = actual?.provider === "comp"
      ? el("button", { class: "button button-outline", type: "button", text: "Quitar cortesía", onclick: async () => {
        if (!window.confirm(`¿Quitar la cortesía de ${cuenta.email}?`)) return;
        try {
          await api(`/api/admin/cuentas/${encodeURIComponent(cuenta.id)}/cortesia`, { method: "DELETE" });
          show(`Cortesía retirada a ${cuenta.email}.`, "success");
          openCuenta(cuenta.id);
        } catch (error) { fail(error); }
      } })
      : null;

    const maxTokens = Math.max(1, ...consumo.map((row) => Number(row.ai_units_used) || 0));
    const bars = el("div", { class: "bars" }, consumo.map((row) => el("div", { class: "bar" }, [
      el("span", { text: String(row.period_start || "").slice(0, 7) }),
      el("i", { style: `width: ${Math.round(((Number(row.ai_units_used) || 0) / maxTokens) * 100)}%` }),
      el("b", { text: `${num.format(row.ai_units_used || 0)}${row.ai_units_limit ? ` / ${num.format(row.ai_units_limit)}` : ""}` }),
    ])));

    const table = (headers, rows, build) => {
      const t = el("table", { class: "table" }, [el("thead", {}, el("tr", {}, headers.map((h) => el("th", { text: h })))), el("tbody")]);
      fillTable(t, rows, build);
      return el("div", { class: "table-wrap" }, t);
    };

    detalle.replaceChildren(
      el("div", { class: "panel-row" }, [
        el("div", {}, [el("p", { class: "eyebrow", text: "Cuenta" }), el("h2", { text: cuenta.email || cuenta.id }), el("p", { class: "muted small", text: `Alta ${fmtDate(cuenta.created_at)} · último acceso ${fmtDateTime(cuenta.last_sign_in_at)} · ${cuenta.id}` })]),
        el("button", { class: "button button-outline", type: "button", text: "Volver a la lista", onclick: closeCuenta }),
      ]),
      el("div", { class: "panel" }, [
        el("div", { class: "panel-head" }, [el("h3", { text: "Plan" }), el("p", { text: actual ? `${planLabel(actual)} · ${estado(actual.status)} · vence ${fmtDate(actual.status === "trialing" ? actual.trial_ends_at : actual.current_period_end)}` : "Sin plan: usa el núcleo local gratuito." })]),
        el("div", { class: "actions" }, [form, quitar]),
        el("p", { class: "help", text: "Dar una cortesía cancela el plan vigente, también uno pagado; Flow no se cancela desde aquí." }),
      ]),
      el("div", { class: "account-grid" }, [
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: `Consumo de IA por mes` })), consumo.length ? bars : el("p", { class: "muted small", text: "Sin consumo registrado." })]),
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Licencias" })), table(["Plan", "Estado", "Emitida", "Vence", "Clave"], licencias, (row) => el("tr", {}, [cell(row.plan_id), cell(row.status), cell(fmtDate(row.issued_at)), cell(fmtDate(row.expires_at)), cell(row.key_id)]))]),
      ]),
      el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Suscripciones" })), table(["Plan", "Origen", "Estado", "Inicio", "Fin", "Creada"], suscripciones, (row) => el("tr", {}, [cell(row.plan_id), cell(row.provider === "comp" ? "cortesía" : "Flow"), cell(`${estado(row.status)}${row.cancel_at_period_end ? " · termina al cierre" : ""}`), cell(fmtDate(row.current_period_start || row.trial_starts_at)), cell(fmtDate(row.current_period_end || row.trial_ends_at)), cell(fmtDateTime(row.created_at))]))]),
      el("div", { class: "account-grid" }, [
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Activaciones" })), table(["Equipo", "Estado", "Creada", "Consumida"], activaciones, (row) => el("tr", {}, [cell(row.app_instance_id || "—"), cell(row.status), cell(fmtDateTime(row.created_at)), cell(fmtDateTime(row.consumed_at))]))]),
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Últimas peticiones de IA" })), table(["Fecha", "Modelo", "Tokens"], eventos, (row) => el("tr", {}, [cell(fmtDateTime(row.created_at)), cell(String(row.event_metadata?.route_model || "—")), cell(num.format(row.units || 0), "num")]))]),
      ]),
      el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Eventos de cobro" })), table(["Fecha", "Evento", "Estado", "Detalle"], cobros, (row) => el("tr", {}, [cell(fmtDateTime(row.created_at)), cell(row.event_type), cell(row.status), cell(el("code", { text: JSON.stringify(row.event_metadata || {}) }))]))]),
    );
  }

  async function loadConsumo(mes = "") {
    const data = await api(`/api/admin/consumo${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`);
    $("#admin-mes").value = data.mes;
    $("[data-consumo-stats]").replaceChildren(
      stat(`Tokens ${data.mes}`, num.format(data.total_tokens)),
      stat("Peticiones", num.format(data.total_peticiones)),
      stat("Cuentas con uso", num.format(data.cuentas.filter((row) => row.tokens > 0).length)),
    );
    const max = Math.max(1, ...data.modelos.map((row) => row.tokens));
    $("[data-consumo-modelos]").replaceChildren(...(data.modelos.length ? data.modelos.map((row) => el("div", { class: "bar" }, [
      el("span", { text: row.modelo, title: row.modelo }),
      el("i", { style: `width: ${Math.round((row.tokens / max) * 100)}%` }),
      el("b", { text: num.format(row.tokens) }),
    ])) : [el("p", { class: "muted small", text: "Sin peticiones en este mes." })]));
    fillTable($("[data-consumo-tabla]"), data.cuentas, (row) => el("tr", {}, [
      cell(row.correo || row.user_id), cell(row.plan_id), cell(num.format(row.peticiones), "num"), cell(num.format(row.tokens), "num"), cell(row.limite ? num.format(row.limite) : "sin tope", "num"),
    ]));
  }
  $("[data-consumo-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    loadConsumo(new FormData(event.currentTarget).get("mes") || "").catch(fail);
  });

  async function loadPlanes() {
    const data = await api("/api/admin/planes");
    fillTable($("[data-planes-tabla]"), data.planes, (row) => {
      const limit = el("input", { type: "number", min: "0", step: "1000", value: row.ai_units_limit ?? "", placeholder: "sin tope", style: "min-width: 9rem" });
      const listed = el("input", { type: "checkbox" });
      listed.checked = Boolean(row.listed);
      const save = el("button", { class: "button button-small button-outline", type: "button", text: "Guardar", onclick: async () => {
        try {
          const value = limit.value.trim();
          await api(`/api/admin/planes/${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ ai_units_limit: value === "" ? null : Number(value), listed: listed.checked }) });
          show(`Plan ${row.id} actualizado.`, "success");
        } catch (error) { fail(error); }
      } });
      return el("tr", {}, [
        cell(`${row.display_name} (${row.id})`), cell(`$${clp.format(row.monthly_price_clp || 0)}`, "num"), cell(`${row.trial_period_days || 0} días`, "num"), cell(row.license_plan || "—"), cell(listed), cell(limit, "num"), cell(save),
      ]);
    });
  }

  async function start() {
    const session = loadSession();
    if (!session) {
      login.hidden = false;
      return;
    }
    try {
      const me = await api("/api/auth/me");
      $("[data-admin-email]").textContent = me.user?.email || "";
      login.hidden = true;
      app.hidden = false;
      showTab(location.hash.replace("#", "") || "resumen", false);
    } catch (error) {
      if (error.status === 403) show("Esta cuenta no administra pteron.", "error");
      fail(error);
      if (error.status !== 401) login.hidden = false;
    }
  }
  start();
})();
