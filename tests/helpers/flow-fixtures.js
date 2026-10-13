/**
 * Respuestas de Flow copiadas de los ejemplos de su esquema oficial
 * (apiFlow.yaml: Subscription, Invoice, PaymentStatus, Plan, RegisterResult,
 * Customer y Error; la suscripción completa es la de
 * developers.flow.cl/docs/suscripciones/create-suscription). Las pruebas sólo
 * cambian valores: `conCampos` falla si alguien agrega un campo que el ejemplo
 * no trae, y `soloDocumentados` falla si el código lee uno.
 */
export const PAYMENT_STATUS = {
  flowOrder: 3567899,
  commerceOrder: "sf12377",
  requestDate: "2017-07-21 12:32:11",
  status: 1,
  subject: "game console",
  currency: "CLP",
  amount: 12000,
  payer: "pperez@gamil.com",
  optional: { RUT: "7025521-9", ID: "899564778" },
  pending_info: { media: "Multicaja", date: "2017-07-21 10:30:12" },
  paymentData: {
    date: "2017-07-21 12:32:11",
    media: "webpay",
    conversionDate: "2017-07-21",
    conversionRate: 1.1,
    amount: 12000,
    currency: "CLP",
    fee: 551,
    balance: 11499,
    transferDate: "2017-07-24",
  },
  merchantId: "string",
};

export const INVOICE = {
  id: 1034,
  subscriptionId: "sus_azcyjj9ycd",
  customerId: "cus_eblcbsua2g",
  created: "2018-06-26 17:29:06",
  subject: "PlanPesos - período 2018-06-27 / 2018-06-27",
  currency: "CLP",
  amount: 20000,
  period_start: "2018-06-27 00:00:00",
  period_end: "2018-07-26 00:00:00",
  attemp_count: 0,
  attemped: 1,
  next_attemp_date: "2018-07-27 00:00:00",
  due_date: "2018-06-30 00:00:00",
  status: 0,
  error: 0,
  errorDate: "2018-06-30 00:00:00",
  errorDescription: "The minimum amount is 350 CLP",
  items: [{ id: 567, subject: "PlanPesos - período 2018-06-27 / 2018-06-27", type: 1, currency: "CLP", amount: 20000 }],
  payment: PAYMENT_STATUS,
  outsidePayment: { date: "2021-03-08 00:00:00", comment: "Pago por caja" },
  paymentLink: "https://www.flow.cl/app/web/pay.php?token=7C18C35358FEF0E33C056C719E94956D4FC9BBEL",
  chargeAttemps: [{
    id: 901,
    date: "2018-12-06 15:03:33",
    customerId: "cus_1uqfm95dch",
    invoiceId: 1234,
    commerceOrder: "1883",
    currency: "CLP",
    amount: 90000,
    errorCode: 1605,
    errorDescription: "This commerceOrder 1883 has been previously paid",
  }],
};

export const SUBSCRIPTION = {
  subscriptionId: "sus_azcyjj9ycd",
  planId: "MiPlanMensual",
  plan_name: "Plan mensual",
  customerId: "cus_eblcbsua2g",
  created: "2018-06-26 17:29:06",
  subscription_start: "2018-06-26 17:29:06",
  subscription_end: "2019-06-25 00:00:00",
  period_start: "2018-06-26 00:00:00",
  period_end: "2018-06-26 00:00:00",
  next_invoice_date: "2018-06-27 00:00:00",
  trial_period_days: 1,
  trial_start: "2018-06-26 00:00:00",
  trial_end: "2018-06-26 00:00:00",
  cancel_at_period_end: 0,
  cancel_at: null,
  periods_number: 12,
  days_until_due: 3,
  status: 1,
  discount_balance: "20000.0000",
  newPlanId: 12,
  new_plan_scheduled_change_date: null,
  in_new_plan_next_attempt_date: null,
  morose: 0,
  discount: {
    id: 181,
    type: "Subscription discount",
    created: "2019-12-01 00:00:00",
    start: "2019-12-01 00:00:00",
    end: "2019-12-31 00:00:00",
    deleted: "2019-12-25 00:00:00",
    status: 1,
    coupon: {
      id: 166,
      name: 166,
      percent_off: 10,
      currency: "CLP",
      amount: 2000,
      created: "2018-07-13 09:57:53",
      duration: 1,
      times: 1,
      max_redemptions: 50,
      expires: "2018-12-31 00:00:00",
      status: 1,
      discount_scope: 1,
      redemtions: 21,
    },
  },
  invoices: [INVOICE],
};

export const PLAN = {
  planId: "myPlan01",
  name: "Plan junior",
  currency: "CLP",
  amount: 20000,
  interval: 3,
  interval_count: 1,
  created: "2017-07-21 12:33:15",
  trial_period_days: 15,
  days_until_due: 3,
  periods_number: 12,
  urlCallback: "https://www.comercio.cl/flow/suscriptionResult.php",
  charges_retries_number: 3,
  currency_convert_option: 0,
  status: 1,
  public: 1,
};

export const REGISTER_RESULT = { status: "1", customerId: "cus_onoolldvec", creditCardType: "Visa", last4CardDigits: "0366" };

export const CUSTOMER = {
  customerId: "cus_onoolldvec",
  created: "2017-07-21 12:33:15",
  email: "customer@gmail.com",
  name: "Pedro Raul Perez",
  creditCardType: "Visa",
  last4CardDigits: "4425",
  externalId: "14233531-8",
  status: "1",
  registerDate: "2017-07-21 14:22:01",
};

/** Respuesta de /customer/register. */
export const REGISTER = { url: "https://www.flow.cl/app/customer/disclaimer.php", token: "41097C28B5BD78C77F589FE4BC59E18AC333F9EU" };

/** Objeto Error con que Flow responde un 400 o un 401. */
export const FLOW_ERROR = { code: 401, message: "Bad Request" };

/** El ejemplo con otros valores en campos que ya trae; uno nuevo es un campo inventado. */
export function conCampos(ejemplo, cambios = {}) {
  for (const campo of Object.keys(cambios)) {
    if (!Object.hasOwn(ejemplo, campo)) throw new Error(`El ejemplo de Flow no trae el campo ${campo}`);
  }
  return { ...structuredClone(ejemplo), ...cambios };
}

export const suscripcion = (cambios) => conCampos(SUBSCRIPTION, cambios);
export const factura = (cambios) => conCampos(INVOICE, cambios);
export const pago = (cambios) => conCampos(PAYMENT_STATUS, cambios);
export const planFlow = (cambios) => conCampos(PLAN, cambios);
export const registro = (cambios) => conCampos(REGISTER_RESULT, cambios);
export const cliente = (cambios) => conCampos(CUSTOMER, cambios);

/**
 * Basic de pteron con 7 días de prueba desde el 13-oct-2026, sobre el ejemplo
 * de Flow: los fines son inclusivos (la prueba cubre del 13 al 19) y el primer
 * cobro es el 20.
 */
export function basicEnPrueba(cambios = {}) {
  return suscripcion({
    subscriptionId: "sus_basic01",
    planId: "pteron-basic-2990-mensual",
    plan_name: "pteron Basic",
    customerId: "cus_1",
    created: "2026-10-13 15:20:00",
    subscription_start: "2026-10-13 15:20:00",
    subscription_end: null,
    period_start: "2026-10-13 00:00:00",
    period_end: "2026-10-19 00:00:00",
    next_invoice_date: "2026-10-20 00:00:00",
    trial_period_days: 7,
    trial_start: "2026-10-13 00:00:00",
    trial_end: "2026-10-19 00:00:00",
    periods_number: 0,
    status: 2,
    discount_balance: "0.0000",
    newPlanId: null,
    discount: null,
    invoices: [],
    ...cambios,
  });
}

/** Un importe mensual de $2.990 de esa suscripción: pagado, o rechazado con su link de pago. */
export function cobroMensual({ id, desde, hasta, pagado, flowOrder }) {
  const subject = `pteron Basic - período ${desde} / ${hasta}`;
  // Vence a los 3 días de generado (days_until_due).
  const vence = new Date(Date.parse(`${desde}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
  return factura({
    id,
    subscriptionId: "sus_basic01",
    customerId: "cus_1",
    created: `${desde} 00:05:00`,
    subject,
    amount: 2990,
    period_start: `${desde} 00:00:00`,
    period_end: `${hasta} 00:00:00`,
    attemp_count: 1,
    next_attemp_date: null,
    due_date: `${vence} 00:00:00`,
    status: pagado ? 1 : 0,
    error: pagado ? 0 : 1,
    errorDate: pagado ? null : `${desde} 00:05:00`,
    errorDescription: pagado ? null : "Tarjeta rechazada",
    items: [{ id, subject, type: 1, currency: "CLP", amount: 2990 }],
    payment: pago({ flowOrder, commerceOrder: String(id), requestDate: `${desde} 00:05:00`, status: pagado ? 2 : 3, subject, amount: 2990, payer: "profe@escuela.cl", pending_info: null, paymentData: null, merchantId: null }),
    outsidePayment: null,
    paymentLink: pagado ? null : `https://www.flow.cl/app/web/pay.php?token=PAGO${id}`,
    chargeAttemps: [],
  });
}

/** Copia que lanza si alguien lee un campo que el ejemplo de Flow no trae. */
export function soloDocumentados(valor, ruta = "flow") {
  if (Array.isArray(valor)) return valor.map((item, indice) => soloDocumentados(item, `${ruta}[${indice}]`));
  if (!valor || typeof valor !== "object") return valor;
  const copia = Object.fromEntries(Object.entries(valor).map(([campo, interno]) => [campo, soloDocumentados(interno, `${ruta}.${campo}`)]));
  return new Proxy(copia, {
    get(target, campo, receiver) {
      if (typeof campo === "string" && !Object.hasOwn(target, campo)) throw new Error(`${ruta}.${campo} no está en el esquema de Flow`);
      return Reflect.get(target, campo, receiver);
    },
  });
}
