-- Esquema completo de pteron en Supabase: cuentas, cobro, activación, licencias
-- y uso de la IA incluida. No guarda contenido del profesor; sólo metadatos de
-- cuenta y de derechos.
--
-- Es el único archivo de la base: no hay historial de migraciones. Se pega
-- entero en Supabase › SQL Editor y corre en una sola transacción, tanto en un
-- proyecto nuevo como en uno que ya tenga una versión anterior. Primero borra
-- lo que pteron creó alguna vez (salvo el disparador de `auth.users`, que se
-- reemplaza) y después lo crea de nuevo, así que correrlo otra vez da el
-- mismo resultado.
--
-- BORRA TODOS LOS DATOS DE PTERON: suscripciones, licencias, activaciones,
-- eventos de cobro, uso y ajustes, salvo qué cliente de Flow es de cada cuenta
-- (`billing_customers`, ver la sección 0). No toca las cuentas de `auth.users`:
-- sus perfiles se vuelven a crear al final de la sección 3. Una cortesía o una
-- suscripción de prueba hay que volver a darla desde /admin.

begin;

-- ── 0. Borrar lo anterior ────────────────────────────────────────────────
-- Todo lo que crearon las migraciones de agosto a octubre de 2026, también lo
-- que ya no se usa: reserve_ai_usage (lo reemplazaron begin_ai_request y
-- finish_ai_request) y el esquema `admin` del editor SQL (dar_plan,
-- quitar_plan, ventas y resumen; /admin hace lo mismo desde el Worker).
-- Las tablas arrastran con `cascade` sus índices, disparadores y políticas.
--
-- El disparador de `auth.users` y su función no se borran: la función se
-- reemplaza en la sección 3 y el disparador sólo se crea si falta. Borrarlo
-- exige ser dueño de `auth.users`, que en Supabase es del servicio de Auth.

drop view if exists admin.resumen;
drop view if exists admin.ventas;
drop function if exists admin.dar_plan(text, text, integer);
drop function if exists admin.quitar_plan(text);

-- El esquema `admin` sólo se borra si quedó vacío: si alguien guardó ahí algo
-- propio, se conserva y se avisa.
do $$
begin
  drop schema if exists admin;
exception when dependent_objects_still_exist then
  raise notice 'El esquema admin tiene objetos que no son de pteron; se conserva.';
end $$;

-- Lo único que se conserva: qué cliente de Flow es de qué cuenta. Flow no deja
-- repetir el identificador externo (el id de `auth.users`, que no cambia), así
-- que perderlo dejaría sin poder comprar a quien ya pasó por un checkout. Se
-- guarda aquí y vuelve a `billing_customers` en la sección 7. El SQL dinámico
-- deja correr el archivo en un proyecto donde esas tablas no existen.
create temp table pteron_clientes_flow (
  user_id uuid not null,
  provider_customer_id text not null,
  prioridad integer not null,
  created_at timestamptz
) on commit drop;

do $$
begin
  if to_regclass('public.billing_customers') is not null then
    execute 'insert into pteron_clientes_flow
      select user_id, provider_customer_id, 0, created_at from public.billing_customers
      where provider_customer_id is not null';
  end if;
  if to_regclass('public.billing_checkout_intents') is not null then
    execute 'insert into pteron_clientes_flow
      select user_id, provider_customer_id, 1, created_at from public.billing_checkout_intents
      where provider_customer_id is not null';
  end if;
  if to_regclass('public.subscriptions') is not null then
    execute 'insert into pteron_clientes_flow
      select user_id, provider_customer_id, 1, created_at from public.subscriptions
      where provider = ''flow'' and provider_customer_id is not null';
  end if;
end $$;

drop table if exists
  public.ai_requests,
  public.app_settings,
  public.billing_customers,
  public.billing_checkout_intents,
  public.usage_events,
  public.usage_periods,
  public.billing_events,
  public.activation_intents,
  public.licenses,
  public.subscriptions,
  public.profiles,
  public.plan_catalog
  cascade;

drop function if exists public.set_updated_at();
drop function if exists public.reserve_ai_usage(uuid, text, timestamptz, timestamptz, integer, integer);
drop function if exists public.reserve_ai_usage(uuid, text, timestamptz, timestamptz, integer, integer, jsonb);
drop function if exists public.begin_ai_request(uuid, uuid, text, timestamptz, timestamptz, integer, integer, integer);
drop function if exists public.finish_ai_request(uuid, integer, jsonb);
drop function if exists public.admin_usage_by_account(timestamptz, timestamptz);
drop function if exists public.admin_usage_by_model(timestamptz, timestamptz);

-- ── 1. updated_at automático ─────────────────────────────────────────────
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 2. Catálogo de planes ────────────────────────────────────────────────
-- Tres ejes por plan: `active` (sigue vigente y se puede conceder), `listed`
-- (se muestra en /planes y /cuenta) y `for_sale` (el checkout lo cobra). La
-- política pública lee `active and listed`; `for_sale` se lee, no filtra.
--
-- Las cuotas se cuentan en unidades de IA: 1 unidad = US$0,0000001 de costo a
-- precio de lista, el de un token de entrada del modelo del gateway. El Worker
-- convierte el uso de cada respuesta con su tabla de precios.
--
-- `license_plan` es el plan que viaja en la licencia firmada. La app sólo
-- reconoce 'basic' y 'pro' y descarta en silencio cualquier otro: el CHECK deja
-- ese contrato escrito donde no se puede ignorar.
create table public.plan_catalog (
  id text primary key,
  display_name text not null,
  monthly_price_clp integer not null check (monthly_price_clp >= 0),
  trial_period_days integer not null default 0 check (trial_period_days >= 0),
  ai_units_limit integer check (ai_units_limit is null or ai_units_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  listed boolean not null default true,
  license_plan text check (license_plan in ('basic', 'pro')),
  trial_ai_units_limit integer check (trial_ai_units_limit is null or trial_ai_units_limit >= 0),
  for_sale boolean not null default false
);

comment on column public.plan_catalog.ai_units_limit is
  'Unidades de IA por período (1 unidad = US$0,0000001 a precio de lista). null = sin tope.';
comment on column public.plan_catalog.listed is
  'false = existe y se puede conceder a mano, pero no aparece en la web.';
comment on column public.plan_catalog.license_plan is
  'Valor de `plan` en la licencia firmada. null = este plan no emite licencia.';
comment on column public.plan_catalog.trial_ai_units_limit is
  'Unidades de IA durante la prueba. null = un cuarto de ai_units_limit.';
comment on column public.plan_catalog.for_sale is
  'true = el checkout lo cobra. false = existe, y puede mostrarse, pero no se vende.';

create trigger plan_catalog_set_updated_at
before update on public.plan_catalog
for each row execute function public.set_updated_at();

-- Decisiones de Marco del 2026-10-13: Basic a $2.990 al mes, IVA incluido, con
-- 7 días de prueba; Pro a $9.990 sin prueba y con cinco veces la cuota de
-- Basic. La prueba recibe un cuarto de la cuota porque no se cobra. `tester`
-- es la cortesía: da lo mismo que Basic, a $0, fuera de la vitrina, y su
-- licencia se firma como Basic. `free` no emite licencia: el núcleo local no
-- la necesita. Nada nace a la venta; Marco la abre desde /admin.
insert into public.plan_catalog
  (id, display_name, monthly_price_clp, trial_period_days, ai_units_limit,
   listed, license_plan, trial_ai_units_limit, for_sale)
values
  ('free',   'Gratis', 0,    0, null,     true,  null,    null,    false),
  ('basic',  'Basic',  2990, 7, 6000000,  true,  'basic', 1500000, false),
  ('pro',    'Pro',    9990, 0, 30000000, true,  'pro',   null,    false),
  ('tester', 'Tester', 0,    0, 6000000,  false, 'basic', null,    false);

-- ── 3. Perfiles ──────────────────────────────────────────────────────────
-- Un perfil por cuenta de Supabase Auth, creado por un disparador sobre
-- `auth.users`. La función es interna: no se expone como RPC.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Se crea si falta y se rehace sólo si no es el de pteron (otra función,
-- otro evento, desactivado o con condición): así una base que ya lo tiene
-- correcto no necesita tocar `auth.users`.
do $$
declare
  v_trigger record;
begin
  select t.tgfoid, t.tgtype, t.tgenabled, t.tgqual
    into v_trigger
    from pg_trigger t
   where t.tgrelid = 'auth.users'::regclass
     and t.tgname = 'on_auth_user_created';
  if found
     and v_trigger.tgfoid = 'public.handle_new_user()'::regprocedure
     -- 5 = FOR EACH ROW (1) + INSERT (4), sin BEFORE ni otros eventos.
     and v_trigger.tgtype = 5
     and v_trigger.tgenabled = 'O'
     and v_trigger.tgqual is null then
    return;
  end if;
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
end $$;

-- Las cuentas que ya existían no vuelven a pasar por el disparador: su perfil
-- se crea aquí, con el mismo nombre que les habría puesto.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- ── 4. Suscripciones ─────────────────────────────────────────────────────
-- `provider` = 'flow' es cobro real; 'comp' es una cortesía concedida desde
-- /admin. Una sola suscripción vigente por cuenta.
--
-- El período lo fija lo que dice Flow: el Worker lee subscription/get (en el
-- retorno de la tarjeta, en el aviso de Flow, al renovar la licencia y en un
-- cron diario) y deja aquí lo que necesita para decidir sin volver a
-- preguntar. Los valores de Flow se guardan tal como vienen, sin CHECK: si
-- Flow estrena un código, la sincronización debe seguir escribiendo la fila;
-- el que decide es `status`, que sí está acotado.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(id),
  provider text not null default 'flow'
    constraint subscriptions_provider_check check (provider in ('flow', 'comp')),
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_plan_id text,
  provider_status smallint,
  morose smallint,
  next_invoice_at timestamptz,
  payment_link text,
  last_synced_at timestamptz,
  terms_version text
);

comment on column public.subscriptions.provider is
  'flow = cobro real vía Flow. comp = cortesía concedida a mano, sin cobro.';
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

create unique index subscriptions_one_current_per_user
  on public.subscriptions (user_id)
  where status in ('incomplete', 'trialing', 'active', 'past_due', 'paused');

create index subscriptions_user_id_idx on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ── 5. Licencias ─────────────────────────────────────────────────────────
-- Una fila por cuenta (`subject`), reescrita en cada renovación. Sólo se
-- guarda el hash del token firmado, nunca el token.
create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null unique,
  plan_id text not null references public.plan_catalog(id),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  key_id text not null,
  token_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licenses_user_id_idx on public.licenses (user_id);

create trigger licenses_set_updated_at
before update on public.licenses
for each row execute function public.set_updated_at();

-- ── 6. Activación de la app ──────────────────────────────────────────────
-- El código de un solo uso que une una instalación con una cuenta. Sólo lo
-- cambia el servidor, después de validar la sesión o el código; el navegador
-- puede leer los suyos.
create table public.activation_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  code_hash text not null unique,
  app_instance_id text,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activation_intents_status_expires_idx
  on public.activation_intents (status, expires_at);
create index activation_intents_user_id_idx on public.activation_intents (user_id);

create trigger activation_intents_set_updated_at
before update on public.activation_intents
for each row execute function public.set_updated_at();

-- ── 7. Cobro con Flow ────────────────────────────────────────────────────
-- Eventos de cobro: rastro de avisos de Flow, retornos y conciliaciones, con
-- un id externo único para no procesar dos veces el mismo aviso.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'flow' check (provider = 'flow'),
  external_event_id text not null unique,
  event_type text not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index billing_events_user_id_idx on public.billing_events (user_id);

-- Estado breve del registro de la tarjeta en Flow. Nunca guarda números de
-- tarjeta, códigos de seguridad ni tokens de Flow. El intento fija lo que se
-- ofreció cuando la persona aceptó (los días de prueba, 0 si ya tuvo una
-- suscripción Flow, y la versión de los Términos) y guarda la suscripción de
-- Flow apenas existe, antes de insertar la fila local: si ese insert falla, el
-- Worker sabe qué suscripción cancelar en vez de dejarla cobrando sin plan.
create table public.billing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(id),
  provider_customer_id text,
  provider_plan_id text,
  status text not null default 'card_registration_pending'
    check (status in ('card_registration_pending', 'subscription_pending', 'completed', 'failed', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trial_days integer not null default 0 check (trial_days >= 0),
  terms_version text,
  provider_subscription_id text
);

create index billing_checkout_intents_user_idx
  on public.billing_checkout_intents (user_id, created_at desc);

create index billing_checkout_intents_active_idx
  on public.billing_checkout_intents (status, expires_at);

create trigger billing_checkout_intents_set_updated_at
before update on public.billing_checkout_intents
for each row execute function public.set_updated_at();

-- Un cliente de Flow por cuenta, guardado apenas Flow responde: Flow no deja
-- repetir el identificador externo, y perderlo dejaría a esa persona sin poder
-- comprar.
create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'flow',
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

-- Los clientes guardados en la sección 0: el de billing_customers primero y,
-- si no hay, el más reciente de los checkouts y suscripciones.
insert into public.billing_customers (user_id, provider, provider_customer_id, created_at)
select distinct on (c.user_id) c.user_id, 'flow', c.provider_customer_id, coalesce(c.created_at, now())
from pteron_clientes_flow c
join auth.users u on u.id = c.user_id
order by c.user_id, c.prioridad, c.created_at desc nulls last
on conflict do nothing;

-- ── 8. Uso de la IA incluida ─────────────────────────────────────────────
-- Un período por cuenta y fecha de inicio. El límite se fotografía al abrirlo
-- y no cambia después: un cambio de cuota rige desde el período siguiente.
create table public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  ai_units_used integer not null default 0 check (ai_units_used >= 0),
  ai_units_limit integer check (ai_units_limit is null or ai_units_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index usage_periods_user_id_idx on public.usage_periods (user_id);

create trigger usage_periods_set_updated_at
before update on public.usage_periods
for each row execute function public.set_updated_at();

-- Una fila por petición terminada con gasto, con el desglose en
-- `event_metadata` (`route_model`, tokens y unidades).
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null references public.usage_periods(id) on delete cascade,
  event_type text not null,
  units integer not null default 1 check (units > 0),
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- La cuenta de /cuenta y /admin lee por cuenta; los agregados de /admin, por
-- fecha de todas las cuentas.
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
create index usage_events_created_idx on public.usage_events (created_at);

-- ── 9. Interruptores ─────────────────────────────────────────────────────
-- Una fila por interruptor, en jsonb. Con `included_ai_paused` en true el
-- gateway responde 503 included_ai_unavailable con motivo `paused`; si falta
-- o trae otra cosa que false, la IA incluida queda detenida, no abierta.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values ('included_ai_paused', 'false'::jsonb);

-- ── 10. Reservas de IA ───────────────────────────────────────────────────
-- Cada petición reserva un estimado pesimista antes de salir
-- (begin_ai_request) y anota su gasto real al terminar (finish_ai_request),
-- aunque cruce el tope: el gasto ya ocurrió, y esconderlo sólo engaña a
-- /admin. Una reserva que nadie termina vence a los 15 minutos y deja de
-- ocupar cupo.
create table public.ai_requests (
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
create index ai_requests_in_flight_idx
  on public.ai_requests (period_id) where status = 'in_flight';
create index ai_requests_user_in_flight_idx
  on public.ai_requests (user_id) where status = 'in_flight';

-- ── 11. Seguridad por fila ───────────────────────────────────────────────
-- Todas las tablas con RLS. El Worker escribe con la service role, que la
-- salta; /cuenta lee con la sesión del profesor sólo lo suyo y el catálogo
-- visible. billing_events y billing_checkout_intents no tienen políticas: el
-- navegador no las lee.
alter table public.plan_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.licenses enable row level security;
alter table public.activation_intents enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_checkout_intents enable row level security;
alter table public.billing_customers enable row level security;
alter table public.usage_periods enable row level security;
alter table public.usage_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.ai_requests enable row level security;

create policy plan_catalog_public_read
on public.plan_catalog for select
using (active = true and listed = true);

create policy profiles_select_own
on public.profiles for select
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy subscriptions_select_own
on public.subscriptions for select
using ((select auth.uid()) = user_id);

create policy licenses_select_own
on public.licenses for select
using ((select auth.uid()) = user_id);

create policy activation_intents_select_own
on public.activation_intents for select
using ((select auth.uid()) = user_id);

create policy usage_periods_select_own
on public.usage_periods for select
using ((select auth.uid()) = user_id);

create policy usage_events_select_own
on public.usage_events for select
using ((select auth.uid()) = user_id);

-- Tablas sólo del servidor: RLS sin políticas le niega todo al navegador, y
-- además se quitan los permisos que Supabase da por defecto a anon y
-- authenticated en `public`, para que una política agregada por error tampoco
-- las abra.
revoke all on table public.billing_customers, public.app_settings, public.ai_requests,
  public.billing_events, public.billing_checkout_intents
  from anon, authenticated;

-- El Worker entra como service_role. Su permiso se da aquí y no depende de los
-- privilegios por defecto del proyecto: uno que no expone las tablas nuevas a
-- la API no se lo daría, y el Worker no podría leer ni escribir nada.
grant select, insert, update, delete on all tables in schema public to service_role;

-- ── 12. Abrir una petición de IA ─────────────────────────────────────────
-- El Worker calcula el período y su límite con la suscripción vigente; aquí
-- se decide y se reserva en una sola transacción. Responde `paused`,
-- `concurrency_limited`, `quota_exceeded` u `ok`.
create function public.begin_ai_request(
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

-- ── 13. Cerrar una petición de IA ────────────────────────────────────────
create function public.finish_ai_request(
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

-- ── 14. Consumo para /admin ──────────────────────────────────────────────
-- Supabase entrega como máximo 1.000 filas por consulta sin avisar: sumar los
-- eventos en el Worker truncaría el consumo de un mes con más peticiones.
-- Estas funciones agregan en la base y devuelven una fila por cuenta o por
-- modelo, según la fecha del evento en [p_from, p_to). `route_model` es null
-- en los eventos que no lo anotaron.
create function public.admin_usage_by_account(p_from timestamptz, p_to timestamptz)
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

create function public.admin_usage_by_model(p_from timestamptz, p_to timestamptz)
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

-- ── 15. Quién ejecuta las RPC ────────────────────────────────────────────
-- Infraestructura del Worker, nunca una RPC que un cliente anónimo o
-- autenticado pueda invocar. Supabase concede EXECUTE a anon y authenticated
-- por defecto en `public`, así que no basta con quitárselo a public.
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

-- ── 16. Avisar a la API ──────────────────────────────────────────────────
-- PostgREST guarda el esquema en caché: sin esto, las tablas y RPC nuevas
-- responderían 404 hasta su próxima recarga.
notify pgrst, 'reload schema';

commit;
