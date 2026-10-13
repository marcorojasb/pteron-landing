/* Administración de pteron: cuentas, cortesías, consumo, venta, cuota y salud. Sólo DOM, sin HTML inyectado. */
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
  // Una unidad de IA vale US$0,0000001 a precio de lista (src/lib/units.js): 10.000.000 unidades = US$1.
  const UNITS_PER_USD = 10_000_000;
  const usdCents = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usdFine = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const usd = (units) => {
    const value = (Number(units) || 0) / UNITS_PER_USD;
    return (value > 0 && value < 0.01 ? usdFine : usdCents).format(value);
  };
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
  // "2026-10" → "octubre de 2026": se lee mejor y se corta en los espacios, no en el guion.
  const monthName = (label) => {
    const [year, month] = String(label).split("-").map(Number);
    if (!year || !month) return label;
    return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  };
  const estado = (s) => ({ trialing: "En prueba", active: "Activa", past_due: "Pago pendiente", paused: "Pausada", canceled: "Cancelada", expired: "Terminada", incomplete: "Pendiente" }[s] || s || "—");
  const planLabel = (row) => (row ? `${row.plan_id}${row.provider === "comp" ? " · cortesía" : ""}` : "núcleo local");
  const CURRENT_STATES = ["incomplete", "trialing", "active", "past_due", "paused"];

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
  // Un resultado se lee en el texto, no sólo en el color.
  const result = (value, yes = "Sí", no = "No") => el("span", {
    class: `resultado ${value === true ? "resultado-si" : value === false ? "resultado-no" : "resultado-na"}`,
    text: value === true ? yes : value === false ? no : "No aplica",
  });

  // Pestañas por fragmento (#cuentas) para poder enlazar y volver atrás.
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const views = [...document.querySelectorAll("[data-view]")];
  const loaded = new Set();
  const loaders = { resumen: loadResumen, cuentas: loadCuentas, consumo: loadConsumo, planes: loadPlanes, salud: loadSalud };
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
      stat("CLP / mes recurrente", `$${clp.format(resumen.clp_mes_recurrente)}`, "a precio de catálogo"),
      stat(`Consumo de IA, ${monthName(resumen.mes)}`, usd(resumen.unidades_mes), `${num.format(resumen.unidades_mes)} unidades · ${num.format(resumen.cuentas_con_uso)} cuentas con uso`),
      stat("Licencias vigentes", num.format(resumen.licencias_vigentes)),
      stat("Venta", resumen.a_la_venta.length ? "Abierta" : "Cerrada", resumen.a_la_venta.length ? resumen.a_la_venta.join(", ") : "ningún plan a la venta"),
      stat("IA incluida", resumen.ia_incluida_pausada ? "En pausa" : "Activa", resumen.ia_incluida_pausada ? "se reanuda en Salud" : null),
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
    $("[data-cuentas-total]").textContent = `${num.format(data.total)} cuenta${data.total === 1 ? "" : "s"}`;
    fillTable($("[data-cuentas-tabla]"), data.cuentas, (row) => el("tr", {}, [
      cell(row.email || row.id),
      cell(fmtDate(row.created_at)),
      cell(planLabel(row.suscripcion)),
      cell(row.suscripcion ? estado(row.suscripcion.status) : "—"),
      cell(row.suscripcion ? fmtDate(row.suscripcion.status === "trialing" ? row.suscripcion.trial_ends_at : row.suscripcion.current_period_end) : "—"),
      cell(row.licencia ? `${row.licencia.plan_id} · vence ${fmtDate(row.licencia.expires_at)}` : "—"),
      cell(row.consumo_periodo ? `${num.format(row.consumo_periodo.ai_units_used || 0)}${row.consumo_periodo.ai_units_limit !== null ? ` de ${num.format(row.consumo_periodo.ai_units_limit)}` : ""}` : "—", "num"),
      cell(el("button", { class: "button button-small button-outline", type: "button", text: "Ver", "aria-label": `Ver ${row.email || row.id}`, onclick: () => openCuenta(row.id) })),
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

  // Lo que dice el plan vigente, en una línea: hasta cuándo, el próximo cobro y si debe algo.
  function describePlan(actual) {
    if (!actual) return "Sin plan: usa el núcleo local gratuito.";
    const parts = [planLabel(actual), estado(actual.status)];
    if (actual.provider === "comp") parts.push(`hasta ${fmtDate(actual.current_period_end)}`);
    else {
      if (actual.status === "trialing") parts.push(`prueba hasta ${fmtDate(actual.trial_ends_at)}`);
      else parts.push(`pagado hasta ${fmtDate(actual.current_period_end)}`);
      if (actual.cancel_at_period_end) parts.push("termina al cierre");
      else if (actual.next_invoice_at) parts.push(`próximo cobro ${fmtDate(actual.next_invoice_at)}`);
      if (Number(actual.morose) === 1) parts.push("con un cobro vencido");
    }
    return parts.join(" · ");
  }

  // Cancela en Flow en el acto: para un retracto, un reembolso o un contracargo.
  function terminarForm(cuenta) {
    return el("form", { class: "toolbar admin-terminar", onsubmit: async (event) => {
      event.preventDefault();
      const motivo = String(new FormData(event.currentTarget).get("motivo") || "").trim();
      if (!motivo) {
        show("Escribe el motivo: queda en el registro de cobros.", "error");
        return;
      }
      if (!window.confirm(`¿Terminar ahora el plan de ${cuenta.email}? Se cancela en Flow en el acto y se corta la IA incluida. El reembolso, si corresponde, se hace aparte en Flow.`)) return;
      try {
        const result = await api(`/api/admin/cuentas/${encodeURIComponent(cuenta.id)}/terminar`, { method: "POST", body: JSON.stringify({ motivo }) });
        show(result.flow_cancelada
          ? `Plan de ${cuenta.email} terminado: cancelado en Flow y cerrado aquí.`
          : `Plan de ${cuenta.email} cerrado aquí. No tenía suscripción en Flow: revisa en el panel de Flow que no quede un cobro activo.`, "success");
        openCuenta(cuenta.id);
      } catch (error) { fail(error); }
    } }, [
      el("div", { class: "field" }, [el("label", { for: "terminar-motivo", text: "Motivo" }), el("input", { id: "terminar-motivo", name: "motivo", type: "text", maxlength: "500", required: "", placeholder: "Retracto, reembolso, contracargo…", autocomplete: "off" })]),
      el("button", { class: "button button-peligro", type: "submit", text: "Terminar ahora" }),
    ]);
  }

  function cortesiaForm(cuenta, actual) {
    return el("form", { class: "toolbar", onsubmit: async (event) => {
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
  }

  function renderCuenta(data) {
    const { cuenta, suscripciones, licencias, activaciones, consumo, eventos, cobros } = data;
    const actual = suscripciones.find((row) => CURRENT_STATES.includes(row.status));
    const detalle = $("[data-cuenta-detalle]");
    const paga = actual?.provider === "flow";

    // Una cuenta que paga en Flow no recibe cortesía: primero se termina su plan.
    const acciones = paga
      ? [terminarForm(cuenta)]
      : [cortesiaForm(cuenta, actual), actual?.provider === "comp"
        ? el("button", { class: "button button-outline", type: "button", text: "Quitar cortesía", onclick: async () => {
          if (!window.confirm(`¿Quitar la cortesía de ${cuenta.email}? Sus licencias quedan revocadas.`)) return;
          try {
            await api(`/api/admin/cuentas/${encodeURIComponent(cuenta.id)}/cortesia`, { method: "DELETE" });
            show(`Cortesía retirada a ${cuenta.email}.`, "success");
            openCuenta(cuenta.id);
          } catch (error) { fail(error); }
        } })
        : null];
    // Lo irreversible lleva el aviso marcado; lo demás, una nota.
    const ayuda = paga
      ? el("p", { class: "help", text: "Terminar ahora cancela la suscripción en Flow sin esperar el cierre del período, corta la IA incluida y revoca las licencias. No reembolsa: eso se hace en el panel de Flow. Para darle una cortesía, termina antes su plan." })
      : el("p", { class: "muted small", text: "Una cortesía reemplaza a la cortesía vigente; quitarla revoca las licencias de la cuenta." });

    const maxUnits = Math.max(1, ...consumo.map((row) => Number(row.ai_units_used) || 0));
    const bars = el("div", { class: "bars" }, consumo.map((row) => el("div", { class: "bar" }, [
      el("span", { text: `${fmtDate(row.period_start)} – ${fmtDate(row.period_end)}` }),
      el("i", { style: `width: ${Math.round(((Number(row.ai_units_used) || 0) / maxUnits) * 100)}%` }),
      el("b", { text: `${num.format(row.ai_units_used || 0)}${row.ai_units_limit !== null && row.ai_units_limit !== undefined ? ` / ${num.format(row.ai_units_limit)}` : ""}` }),
    ])));

    const table = (headers, rows, build) => {
      const t = el("table", { class: "table" }, [el("thead", {}, el("tr", {}, headers.map((h) => el("th", { text: h })))), el("tbody")]);
      fillTable(t, rows, build);
      return el("div", { class: "table-wrap" }, t);
    };
    const clientOf = (meta) => [meta?.client_version, meta?.platform].filter(Boolean).join(" · ") || "—";

    detalle.replaceChildren(
      el("div", { class: "panel-row" }, [
        el("div", {}, [el("p", { class: "eyebrow", text: "Cuenta" }), el("h2", { text: cuenta.email || cuenta.id }), el("p", { class: "muted small", text: `Alta ${fmtDate(cuenta.created_at)} · último acceso ${fmtDateTime(cuenta.last_sign_in_at)} · ${cuenta.id}` })]),
        el("button", { class: "button button-outline", type: "button", text: "Volver a la lista", onclick: closeCuenta }),
      ]),
      el("div", { class: "panel" }, [
        el("div", { class: "panel-head" }, [el("h3", { text: "Plan" }), el("p", { text: describePlan(actual) })]),
        el("div", { class: "actions" }, acciones),
        ayuda,
      ]),
      el("div", { class: "account-grid" }, [
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, [el("h3", { text: "Consumo de IA por período" }), el("p", { text: "Unidades usadas / cuota del período" })]), consumo.length ? bars : el("p", { class: "muted small", text: "Sin consumo registrado." })]),
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Licencias" })), table(["Plan", "Estado", "Emitida", "Vence", "Clave"], licencias, (row) => el("tr", {}, [cell(row.plan_id), cell(row.status), cell(fmtDate(row.issued_at)), cell(fmtDate(row.expires_at)), cell(row.key_id)]))]),
      ]),
      el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Suscripciones" })), table(["Plan", "Origen", "Estado", "Inicio", "Pagado hasta", "Próximo cobro", "Revisada en Flow", "Creada"], suscripciones, (row) => el("tr", {}, [
        cell(row.plan_id),
        cell(row.provider === "comp" ? "cortesía" : "Flow"),
        cell(`${estado(row.status)}${row.cancel_at_period_end ? " · termina al cierre" : ""}`),
        cell(fmtDate(row.current_period_start || row.trial_starts_at)),
        cell(fmtDate(row.current_period_end || row.trial_ends_at)),
        cell(row.provider === "comp" ? "—" : fmtDate(row.next_invoice_at)),
        cell(row.provider === "comp" ? "—" : fmtDateTime(row.last_synced_at)),
        cell(fmtDateTime(row.created_at)),
      ]))]),
      el("div", { class: "account-grid" }, [
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Activaciones" })), table(["Equipo", "Estado", "Creada", "Consumida"], activaciones, (row) => el("tr", {}, [cell(row.app_instance_id || "—"), cell(row.status), cell(fmtDateTime(row.created_at)), cell(fmtDateTime(row.consumed_at))]))]),
        el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Últimas peticiones de IA" })), table(["Fecha", "Modelo", "Unidades", "App", "Estado"], eventos, (row) => el("tr", {}, [cell(fmtDateTime(row.created_at)), cell(String(row.event_metadata?.route_model || "—")), cell(num.format(row.units || 0), "num"), cell(clientOf(row.event_metadata)), cell(String(row.event_metadata?.status || "—"))]))]),
      ]),
      el("div", { class: "panel" }, [el("div", { class: "panel-head" }, el("h3", { text: "Eventos de cobro" })), table(["Fecha", "Evento", "Estado", "Detalle"], cobros, (row) => el("tr", {}, [cell(fmtDateTime(row.created_at)), cell(row.event_type), cell(row.status), cell(el("code", { text: JSON.stringify(row.event_metadata || {}) }))]))]),
    );
  }

  async function loadConsumo(mes = "") {
    const data = await api(`/api/admin/consumo${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`);
    $("#admin-mes").value = data.mes;
    $("[data-consumo-stats]").replaceChildren(
      stat(`Consumo de IA, ${monthName(data.mes)}`, usd(data.total_unidades), `${num.format(data.total_unidades)} unidades, a precio de lista`),
      stat("Peticiones", num.format(data.total_peticiones)),
      stat("Cuentas con uso", num.format(data.cuentas.filter((row) => row.unidades > 0).length)),
    );
    const max = Math.max(1, ...data.modelos.map((row) => row.unidades));
    $("[data-consumo-modelos]").replaceChildren(...(data.modelos.length ? data.modelos.map((row) => el("div", { class: "bar" }, [
      el("span", { text: row.modelo, title: row.modelo }),
      el("i", { style: `width: ${Math.round((row.unidades / max) * 100)}%` }),
      el("b", { text: `${num.format(row.unidades)} · ${usd(row.unidades)}` }),
    ])) : [el("p", { class: "muted small", text: "Sin peticiones en este mes." })]));
    fillTable($("[data-consumo-tabla]"), data.cuentas, (row) => el("tr", {}, [
      cell(row.correo || row.user_id),
      cell(row.plan_id ? `${row.plan_id}${row.cortesia ? " · cortesía" : ""}` : "—"),
      cell(num.format(row.peticiones), "num"),
      cell(num.format(row.unidades), "num"),
      cell(usd(row.unidades), "num"),
    ]));
  }
  $("[data-consumo-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    loadConsumo(new FormData(event.currentTarget).get("mes") || "").catch(fail);
  });

  // Un campo de cuota en unidades con su equivalente en US$ debajo, al día mientras se escribe.
  function quotaInput(row, field, label, emptyText) {
    const hintId = `${field}-${row.id}-usd`;
    const input = el("input", { type: "number", min: "0", step: "1", value: row[field] ?? "", placeholder: emptyText, inputmode: "numeric", "aria-label": `${label} de ${row.display_name}, en unidades`, "aria-describedby": hintId });
    const hint = el("small", { class: "equivalente", id: hintId });
    // El campo numérico no admite separadores: la cifra legible va en la línea de abajo.
    const update = () => { hint.textContent = input.value.trim() === "" ? emptyText : `${num.format(Number(input.value))} ≈ ${usd(Number(input.value))}`; };
    input.addEventListener("input", update);
    update();
    return { input, node: el("div", { class: "cuota" }, [input, hint]) };
  }

  async function savePlan(row, values, message) {
    try {
      await api(`/api/admin/planes/${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify(values) });
      show(message, "success");
      loadPlanes().catch(fail);
    } catch (error) { fail(error); }
  }

  async function loadPlanes() {
    const data = await api("/api/admin/planes");
    fillTable($("[data-planes-tabla]"), data.planes, (row) => {
      const name = row.display_name || row.id;
      const listed = el("input", { type: "checkbox", "aria-label": `${name} visible en la web` });
      listed.checked = Boolean(row.listed);
      // Un plan sin licencia (el núcleo local) no usa la IA incluida: su cuota no tiene efecto.
      const quota = row.license_plan ? quotaInput(row, "ai_units_limit", "Cuota por período", "sin tope") : null;
      const trial = row.license_plan && Number(row.trial_period_days) > 0 ? quotaInput(row, "trial_ai_units_limit", "Cuota de prueba", "un cuarto de la cuota") : null;
      // Sólo un plan con precio pasa por Flow; las cortesías y el núcleo local no se venden.
      const venta = Number(row.monthly_price_clp) > 0
        ? el("div", { class: "venta" }, [
          el("span", { text: row.for_sale ? "A la venta" : "Cerrada" }),
          el("button", { class: "button button-small button-outline", type: "button", text: row.for_sale ? "Cerrar la venta" : "Abrir la venta", "aria-label": `${row.for_sale ? "Cerrar" : "Abrir"} la venta de ${name}`, onclick: () => {
            const abrir = !row.for_sale;
            const pregunta = abrir
              ? `¿Abrir la venta de ${name}? El checkout empezará a cobrar $${clp.format(row.monthly_price_clp)} al mes con Flow.`
              : `¿Cerrar la venta de ${name}? Quien ya paga sigue igual; sólo se detienen las compras nuevas.`;
            if (window.confirm(pregunta)) savePlan(row, { for_sale: abrir }, abrir ? `${name} quedó a la venta.` : `${name} ya no se vende.`);
          } }),
        ])
        : el("span", { class: "muted", text: "No se vende" });
      const save = el("button", { class: "button button-small button-outline", type: "button", text: "Guardar", "aria-label": `Guardar ${name}`, onclick: () => {
        const values = { listed: listed.checked };
        for (const [field, control] of [["ai_units_limit", quota], ["trial_ai_units_limit", trial]]) {
          if (!control) continue;
          const value = control.input.value.trim();
          values[field] = value === "" ? null : Number(value);
        }
        savePlan(row, values, `Plan ${name} actualizado. Una cuota nueva rige desde el período siguiente de cada cuenta.`);
      } });
      return el("tr", {}, [
        cell(`${name} (${row.id})`),
        cell(`$${clp.format(row.monthly_price_clp || 0)}`, "num"),
        cell(`${row.trial_period_days || 0} días`, "num"),
        cell(row.license_plan || "—"),
        cell(listed),
        cell(venta),
        cell(quota ? quota.node : el("span", { class: "muted", text: "no usa IA incluida" })),
        cell(trial ? trial.node : el("span", { class: "muted", text: "sin prueba" })),
        cell(save),
      ]);
    });
  }

  const CHEQUEOS = [
    ["esencial", "Lo esencial: lo mismo que mira /api/health"],
    ["supabase", "Supabase responde con la clave del servidor"],
    ["firma", "La firma de licencias k2 se verifica con su clave pública"],
    ["flow", "Flow tiene sus credenciales"],
    ["flow_produccion", "Flow apunta a producción (www.flow.cl)"],
    ["modelo_con_precio", "El modelo del gateway tiene precio conocido"],
    ["anthropic", "La clave de Anthropic responde por ese modelo"],
    ["anthropic_url_oficial", "La IA incluida va a la API oficial de Anthropic"],
    ["catalogo", "El catálogo de planes se puede leer"],
    ["venta", "Cada plan a la venta está completo y su plan de Flow coincide"],
  ];

  function renderPausa(paused) {
    const estadoIa = $("[data-ia-estado]");
    const boton = $("[data-ia-boton]");
    if (paused === null || paused === undefined) {
      estadoIa.textContent = "No se pudo leer el interruptor.";
      boton.hidden = true;
      return;
    }
    estadoIa.textContent = paused ? "La IA incluida está en pausa para todas las cuentas." : "La IA incluida está activa.";
    boton.textContent = paused ? "Reanudar la IA incluida" : "Pausar la IA incluida";
    boton.dataset.paused = String(paused);
    boton.hidden = false;
  }

  $("[data-ia-boton]").addEventListener("click", async (event) => {
    const pausar = event.currentTarget.dataset.paused !== "true";
    if (!window.confirm(pausar ? "¿Pausar la IA incluida para todas las cuentas?" : "¿Reanudar la IA incluida para todas las cuentas?")) return;
    try {
      const data = await api("/api/admin/ajustes", { method: "PATCH", body: JSON.stringify({ included_ai_paused: pausar }) });
      renderPausa(data.included_ai_paused);
      show(data.included_ai_paused ? "La IA incluida quedó en pausa." : "La IA incluida volvió a funcionar.", "success");
    } catch (error) { fail(error); }
  });

  async function loadSalud() {
    const cuando = $("[data-salud-cuando]");
    cuando.textContent = "Revisando Supabase, la firma, Flow y Anthropic…";
    let data;
    try {
      data = await api("/api/admin/salud");
    } catch (error) {
      cuando.textContent = "No se pudo revisar.";
      renderPausa(null);
      throw error;
    }
    cuando.textContent = `Última revisión: ${fmtDateTime(new Date())}`;
    renderPausa(data.ia_incluida_pausada);
    fillTable($("[data-salud-tabla]"), CHEQUEOS, ([key, label]) => el("tr", {}, [cell(label), cell(result(data[key]))]));
    fillTable($("[data-salud-planes]"), data.planes, (row) => el("tr", {}, [
      cell(`${row.nombre} (${row.id})`),
      cell(row.for_sale ? "Sí" : "No"),
      cell(result(row.visible)),
      cell(result(row.precio)),
      cell(result(row.cuota)),
      cell(result(row.licencia)),
      cell(result(row.flow, "Coincide", "No coincide")),
    ]));
    fillTable($("[data-salud-secretos]"), [...Object.entries(data.secretos), ...Object.entries(data.variables)], ([name, present]) => el("tr", {}, [
      cell(el("code", { text: name })),
      cell(result(present, "Cargado", "Falta")),
    ]));
  }
  $("[data-salud-revisar]").addEventListener("click", () => loadSalud().catch(fail));

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
