-- Basic con IA incluida (pteron 0.7.2).
--
-- Lo que la base no sabía hacer: decir qué plan está a la venta, recordar lo
-- que Flow informa de cada suscripción, apagar la IA incluida sin quitar la
-- clave del proveedor y contar el gasto de IA con reservas, para que varias
-- peticiones simultáneas no pasen juntas un tope que sólo una debería pasar.
--
-- Se aplica antes de desplegar el Worker nuevo, y lo más cerca posible del
-- despliegue: el viejo sigue funcionando con esta base (reserve_ai_usage no
-- cambia), pero cobra el precio que trae en su código y no mira `for_sale`,
-- mientras /cuenta ya muestra el del catálogo.

-- ── 1. Catálogo: cuota en unidades, cuota de prueba y venta ──────────────
-- Las cuotas se cuentan en unidades de IA: 1 unidad = US$0,0000001 de costo a
-- precio de lista, el de un token de entrada del modelo del gateway. El Worker
-- convierte el uso de cada respuesta con su tabla de precios.
--
-- `for_sale` es un tercer eje, aparte de `active` y `listed`: un plan puede
-- verse en /planes y /cuenta sin que el checkout lo cobre todavía. Todo queda
-- cerrado; Marco abre la venta desde /admin cuando Flow, los textos y lo legal
-- estén listos. La política pública de lectura sigue siendo `active and
-- listed`: `for_sale` se lee, no filtra.
alter table public.plan_catalog
  add column if not exists trial_ai_units_limit integer
    check (trial_ai_units_limit is null or trial_ai_units_limit >= 0),
  add column if not exists for_sale boolean not null default false;

comment on column public.plan_catalog.ai_units_limit is
  'Unidades de IA por período (1 unidad = US$0,0000001 a precio de lista). null = sin tope.';
comment on column public.plan_catalog.trial_ai_units_limit is
  'Unidades de IA durante la prueba. null = un cuarto de ai_units_limit.';
comment on column public.plan_catalog.for_sale is
  'true = el checkout lo cobra. false = existe, y puede mostrarse, pero no se vende.';

-- Decisiones de Marco del 2026-10-13: Basic a $1.990 al mes, IVA incluido, con
-- 7 días de prueba; Pro a $9.990 sin prueba y con cinco veces la cuota de
-- Basic; la cortesía tester da lo mismo que Basic. La prueba recibe un cuarto
-- de la cuota porque no se cobra. El precio y los días de prueba de Pro ya
-- eran estos; se fijan igual porque el checkout pasa a tomarlos de aquí.
update public.plan_catalog
   set monthly_price_clp    = 1990,
       trial_period_days    = 7,
       ai_units_limit       = 6000000,
       trial_ai_units_limit = 1500000,
       for_sale             = false
 where id = 'basic';

update public.plan_catalog
   set monthly_price_clp    = 9990,
       trial_period_days    = 0,
       ai_units_limit       = 30000000,
       trial_ai_units_limit = null,
       for_sale             = false
 where id = 'pro';

update public.plan_catalog
   set ai_units_limit = 6000000
 where id = 'tester';

-- ── 2. Suscripciones: lo que dice Flow ───────────────────────────────────
-- El período ya no lo avanza el aviso de pago: el Worker lee subscription/get
-- (en el retorno de la tarjeta, en el aviso de Flow, al renovar la licencia y
-- en un cron diario) y deja aquí lo que necesita para decidir sin volver a
-- preguntar. Los valores de Flow se guardan tal como vienen, sin CHECK: si
-- Flow estrena un código, la sincronización debe seguir escribiendo la fila;
-- el que decide es `status`, que sí está acotado.
alter table public.subscriptions
  add column if not exists provider_plan_id text,
  add column if not exists provider_status smallint,
  add column if not exists morose smallint,
  add column if not exists next_invoice_at timestamptz,
  add column if not exists payment_link text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists terms_version text;

-- Las dos columnas de período cambian de significado: ya no son lo que
-- devolvió subscription/create al contratar, sino el período pagado vigente.
comment on column public.subscriptions.current_period_start is
  'Inicio del período pagado vigente; en la prueba, el inicio de la prueba.';
comment on column public.subscriptions.current_period_end is
  'Pagado hasta: el instante en que termina el período pagado vigente (o la prueba). En cortesías, el fin de la cortesía.';
comment on column public.subscriptions.provider_plan_id is
  'planId de Flow de la suscripción.';
comment on column public.subscriptions.provider_status is
  'status de Flow: 0 sin iniciar, 1 activa, 2 en prueba, 4 cancelada.';
comment on column public.subscriptions.morose is
  'morose de Flow: 0 al día, 1 con importes vencidos, 2 con importes pendientes sin vencer.';
comment on column public.subscriptions.next_invoice_at is
  'Próximo cobro según Flow.';
comment on column public.subscriptions.payment_link is
  'Enlace de pago del importe impago más reciente; null si no hay deuda.';
comment on column public.subscriptions.last_synced_at is
  'Última lectura de subscription/get. null = nunca se sincronizó.';
comment on column public.subscriptions.terms_version is
  'Versión de los Términos aceptada al contratar.';

-- ── 3. Intentos de checkout ──────────────────────────────────────────────
-- El intento fija lo que se ofreció cuando la persona aceptó: los días de
-- prueba (0 si ya tuvo una suscripción Flow) y la versión de los Términos.
-- También guarda la suscripción de Flow apenas existe, antes de insertar la
-- fila local: si ese insert falla, el Worker sabe qué suscripción cancelar en
-- vez de dejarla cobrando sin plan.
alter table public.billing_checkout_intents
  add column if not exists trial_days integer not null default 0 check (trial_days >= 0),
  add column if not exists terms_version text,
  add column if not exists provider_subscription_id text;

-- ── 4. Un cliente de Flow por cuenta ─────────────────────────────────────
-- El customerId vivía sólo en los intentos de checkout. Si algo fallaba entre
-- customer/create y el insert del intento, el cliente se perdía, y el checkout
-- siguiente pedía otro con el mismo identificador externo, que según el manual
-- de Flow no puede repetirse: esa persona podía quedar sin poder comprar. Se
-- guarda apenas Flow responde.
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'flow',
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

-- ── 5. Interruptores ─────────────────────────────────────────────────────
-- La IA incluida sólo se apagaba quitando la clave del proveedor (la app
-- decía que no estaba configurada) o con la cuota en 0 (decía que se había
-- agotado): ninguna de las dos daba la causa real. Con `included_ai_paused`
-- el gateway responde 503 included_ai_unavailable con motivo `paused`. Una
-- fila por interruptor, en jsonb, para agregar otro sin migrar.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- `do nothing`: aplicar la migración otra vez no debe reanudar una IA pausada.
insert into public.app_settings (key, value)
values ('included_ai_paused', 'false'::jsonb)
on conflict (key) do nothing;

-- ── 6. Reservas de IA ────────────────────────────────────────────────────
-- reserve_ai_usage sólo comparaba lo usado con el tope antes de llamar al
-- proveedor: diez peticiones simultáneas pasaban juntas con la cuota casi
-- llena, y lo que cruzaba el tope no se anotaba. Ahora cada petición reserva
-- un estimado pesimista antes de salir (begin_ai_request) y anota su gasto
-- real al terminar (finish_ai_request), aunque cruce el tope: el gasto ya
-- ocurrió, y esconderlo sólo engaña a /admin.
--
-- Una reserva que nadie termina (el Worker murió a mitad de la respuesta)
-- vence a los 15 minutos y deja de ocupar cupo.
create table if not exists public.ai_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null references public.usage_periods(id) on delete cascade,
  reserved_units integer not null check (reserved_units >= 0),
  units integer check (units is null or units >= 0),
  status text not null default 'in_flight' check (status in ('in_flight', 'finished', 'expired')),
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Lo reservado se suma por período; las peticiones en vuelo se cuentan por
-- cuenta. Los dos índices cubren sólo las reservas abiertas, que son pocas.
create index if not exists ai_requests_in_flight_idx
  on public.ai_requests (period_id) where status = 'in_flight';
create index if not exists ai_requests_user_in_flight_idx
  on public.ai_requests (user_id) where status = 'in_flight';

-- Tablas sólo del servidor: el Worker las usa con la service role. RLS sin
-- políticas le niega todo al navegador, y además se quitan los permisos que
-- Supabase da por defecto a anon y authenticated en `public`, para que una
-- política agregada por error tampoco las abra.
alter table public.billing_customers enable row level security;
alter table public.app_settings enable row level security;
alter table public.ai_requests enable row level security;
revoke all on table public.billing_customers, public.app_settings, public.ai_requests
  from anon, authenticated;

-- ── 7. Abrir una petición de IA ──────────────────────────────────────────
-- El Worker calcula el período y su límite con la suscripción vigente; aquí
-- se decide y se reserva en una sola transacción. Responde `paused`,
-- `concurrency_limited`, `quota_exceeded` u `ok`.
create or replace function public.begin_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_plan_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer,
  p_estimate integer,
  p_max_in_flight integer
)
returns table (
  allowed boolean,
  reason text,
  units_used integer,
  units_reserved integer,
  units_limit integer,
  period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paused jsonb;
  v_period_id uuid;
  v_used integer;
  v_limit integer;
  v_end timestamptz;
  v_in_flight integer;
  v_reserved bigint;
begin
  -- Un máximo nulo dejaría pasar cualquier cantidad de peticiones, y un
  -- estimado o un límite negativos sólo pueden venir de un error del Worker:
  -- mejor un error visible que una decisión equivocada.
  if p_estimate is null or p_estimate < 0
     or p_max_in_flight is null or p_max_in_flight < 1
     or p_limit < 0 then
    raise exception 'begin_ai_request: estimado, máximo en vuelo o límite inválidos'
      using errcode = '22023';
  end if;

  -- Pausada salvo que la fila diga exactamente false: si falta o trae otra
  -- cosa, la IA incluida queda detenida, no abierta.
  select s.value into v_paused
    from public.app_settings s
   where s.key = 'included_ai_paused';
  if v_paused is distinct from 'false'::jsonb then
    return query select false, 'paused'::text, null::integer, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  -- Un candado por cuenta: dos reservas a ambos lados de un cambio de período
  -- bloquean filas de período distintas y no se verían entre sí al contar las
  -- peticiones en vuelo, que son por cuenta. Se libera al terminar la
  -- transacción.
  perform pg_advisory_xact_lock(hashtext('pteron.ai_requests'), hashtext(p_user_id::text));

  -- El límite se fotografía al abrir el período y no cambia después: un
  -- cambio de cuota en el catálogo rige desde el período siguiente, no a mitad
  -- de un mes ya pagado.
  insert into public.usage_periods (user_id, plan_id, period_start, period_end, ai_units_limit)
  values (p_user_id, p_plan_id, p_period_start, p_period_end, p_limit)
  on conflict (user_id, period_start) do nothing;

  -- Bloquear el período ordena a quienes reservan y a quienes terminan en él:
  -- lo usado y lo reservado se leen sin que otra transacción los cambie entre
  -- medio.
  select up.id, up.ai_units_used, up.ai_units_limit, up.period_end
    into v_period_id, v_used, v_limit, v_end
    from public.usage_periods up
   where up.user_id = p_user_id
     and up.period_start = p_period_start
     for update;

  update public.ai_requests r
     set status = 'expired'
   where r.user_id = p_user_id
     and r.status = 'in_flight'
     and r.created_at < now() - interval '15 minutes';

  select count(*) into v_in_flight
    from public.ai_requests r
   where r.user_id = p_user_id
     and r.status = 'in_flight';

  select coalesce(sum(r.reserved_units), 0) into v_reserved
    from public.ai_requests r
   where r.period_id = v_period_id
     and r.status = 'in_flight';

  if v_in_flight >= p_max_in_flight then
    return query select false, 'concurrency_limited'::text, v_used, v_reserved::integer, v_limit, v_end;
    return;
  end if;

  -- Basta que quede algo libre para entrar, aunque el estimado no quepa
  -- entero: exigirlo dejaría inservible el final de la cuota. Lo que se pase
  -- se anota igual al terminar.
  if v_limit is not null and v_used + v_reserved >= v_limit then
    return query select false, 'quota_exceeded'::text, v_used, v_reserved::integer, v_limit, v_end;
    return;
  end if;

  insert into public.ai_requests (id, user_id, period_id, reserved_units)
  values (p_request_id, p_user_id, v_period_id, p_estimate);

  return query select true, 'ok'::text, v_used, (v_reserved + p_estimate)::integer, v_limit, v_end;
end;
$$;

-- ── 8. Cerrar una petición de IA ─────────────────────────────────────────
create or replace function public.finish_ai_request(
  p_request_id uuid,
  p_units integer,
  p_metadata jsonb
)
returns table (units_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id uuid;
  v_user_id uuid;
  v_used integer;
begin
  if p_units is null or p_units < 0 then
    raise exception 'finish_ai_request: unidades inválidas'
      using errcode = '22023';
  end if;

  select r.period_id, r.user_id into v_period_id, v_user_id
    from public.ai_requests r
   where r.id = p_request_id;
  if v_period_id is null then
    return query select null::integer;
    return;
  end if;

  -- Mismo orden de candados que begin_ai_request, primero el período y después
  -- la reserva: tomarlos en orden inverso podría trabar a las dos funciones.
  select up.ai_units_used into v_used
    from public.usage_periods up
   where up.id = v_period_id
     for update;

  -- Idempotente: el Worker reintenta, y un reintento no suma dos veces. Una
  -- reserva vencida todavía se cierra: su petición siguió viva más de 15
  -- minutos y el proveedor la cobró igual.
  update public.ai_requests r
     set status = 'finished',
         units = p_units,
         event_metadata = coalesce(p_metadata, '{}'::jsonb),
         finished_at = now()
   where r.id = p_request_id
     and r.status in ('in_flight', 'expired');
  if not found then
    return query select v_used;
    return;
  end if;

  -- Sin unidades no hay evento: usage_events exige units > 0, y una
  -- respuesta fallida del proveedor no gastó cuota.
  if p_units > 0 then
    update public.usage_periods up
       set ai_units_used = up.ai_units_used + p_units
     where up.id = v_period_id
    returning up.ai_units_used into v_used;

    insert into public.usage_events (user_id, period_id, event_type, units, event_metadata)
    values (v_user_id, v_period_id, 'gateway_message', p_units, coalesce(p_metadata, '{}'::jsonb));
  end if;

  return query select v_used;
end;
$$;

-- ── 9. Consumo para /admin ───────────────────────────────────────────────
-- /admin traía los eventos del mes y los sumaba en el Worker, pero Supabase
-- entrega como máximo 1.000 filas por consulta sin avisar: en cuanto el mes
-- pasaba de mil peticiones, el consumo salía truncado. Estas funciones agregan
-- en la base y devuelven una fila por cuenta o por modelo, según la fecha del
-- evento en [p_from, p_to). `route_model` es null en los eventos que no lo
-- anotaron.
create or replace function public.admin_usage_by_account(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, requests bigint, units bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, count(*), sum(e.units)
    from public.usage_events e
   where e.created_at >= p_from
     and e.created_at < p_to
   group by e.user_id
   order by 3 desc, 1;
$$;

create or replace function public.admin_usage_by_model(p_from timestamptz, p_to timestamptz)
returns table (route_model text, requests bigint, units bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.event_metadata ->> 'route_model', count(*), sum(e.units)
    from public.usage_events e
   where e.created_at >= p_from
     and e.created_at < p_to
   group by 1
   order by 3 desc, 1;
$$;

-- Los agregados filtran por fecha de todas las cuentas; el índice existente
-- empieza por la cuenta y no les sirve.
create index if not exists usage_events_created_idx on public.usage_events (created_at);

-- Igual que reserve_ai_usage: infraestructura del Worker, nunca una RPC que un
-- cliente anónimo o autenticado pueda invocar. Supabase concede EXECUTE a anon
-- y authenticated por defecto en `public`, así que no basta con quitárselo a
-- public.
revoke execute on function public.begin_ai_request(uuid, uuid, text, timestamptz, timestamptz, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.finish_ai_request(uuid, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.admin_usage_by_account(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_usage_by_model(timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.begin_ai_request(uuid, uuid, text, timestamptz, timestamptz, integer, integer, integer)
  to service_role;
grant execute on function public.finish_ai_request(uuid, integer, jsonb)
  to service_role;
grant execute on function public.admin_usage_by_account(timestamptz, timestamptz)
  to service_role;
grant execute on function public.admin_usage_by_model(timestamptz, timestamptz)
  to service_role;
