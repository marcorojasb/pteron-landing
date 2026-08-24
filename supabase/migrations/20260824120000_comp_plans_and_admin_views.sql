-- Cuentas de cortesía y panel de ventas.
--
-- Dos cosas que no existían: conceder un plan sin cobro detrás, y mirar quién
-- está pagando. Ambas viven en el esquema `admin`, que PostgREST no expone
-- (Supabase solo publica `public` y `graphql_public`). Eso importa: una vista
-- en `public` que cruce `auth.users` queda servida en la API REST y, como las
-- vistas corren con los permisos de su dueño, cualquier usuario autenticado
-- podría leer el correo de todos los demás.

create schema if not exists admin;
revoke all on schema admin from anon, authenticated;

-- ── 1. Planes que existen pero no se ofrecen ─────────────────────────────
-- `active` no sirve para esconder un plan: apagarlo lo vuelve inconcedible
-- además de invisible. Hacen falta dos ejes distintos — si el plan sigue
-- vigente, y si se muestra a quien no lo tiene.
alter table public.plan_catalog
  add column listed boolean not null default true;

comment on column public.plan_catalog.listed is
  'false = existe y se puede conceder a mano, pero no aparece en la web.';

-- La política pública era `active = true`. Ahora también exige `listed`, que es
-- lo único que impide que el plan de cortesía salga en /cuenta/ y /planes/.
drop policy plan_catalog_public_read on public.plan_catalog;
create policy plan_catalog_public_read
on public.plan_catalog for select
using (active = true and listed = true);

-- Mismo contenido que Basic — igual límite de IA — pero a $0 y fuera de la
-- vitrina. Solo se entrega con admin.dar_plan().
insert into public.plan_catalog
  (id, display_name, monthly_price_clp, trial_period_days, ai_units_limit, listed)
values
  ('tester', 'Tester', 0, 0, null, false)
on conflict (id) do update set
  display_name      = excluded.display_name,
  monthly_price_clp = excluded.monthly_price_clp,
  trial_period_days = excluded.trial_period_days,
  ai_units_limit    = excluded.ai_units_limit,
  listed            = excluded.listed,
  active            = true,
  updated_at        = now();

-- ── 2. Suscripciones sin proveedor de cobro ──────────────────────────────
-- `provider` estaba fijado a 'flow' por un CHECK. El nombre del constraint lo
-- generó Postgres, así que se busca por su definición en vez de suponerlo:
-- un `drop if exists` con el nombre equivocado no falla, solo deja el
-- constraint viejo en pie y el regalo revienta al insertarse.
do $$
declare nombre text;
begin
  select con.conname into nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public'
     and rel.relname = 'subscriptions'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%provider%';
  if nombre is not null then
    execute format('alter table public.subscriptions drop constraint %I', nombre);
  end if;
end $$;

alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('flow', 'comp'));

comment on column public.subscriptions.provider is
  'flow = cobro real vía Flow. comp = cortesía concedida a mano, sin cobro.';

-- ── 3. Conceder cortesía ─────────────────────────────────────────────────
-- La persona debe haber entrado al menos una vez (el enlace mágico crea la
-- cuenta); sin eso no hay `auth.users` al que colgar la suscripción.
create or replace function admin.dar_plan(
  p_correo text,
  p_plan text default 'tester',
  p_meses integer default 12
)
returns table (correo text, plan text, estado text, vence timestamptz)
language plpgsql
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users
   where lower(email) = lower(trim(p_correo));
  if v_uid is null then
    raise exception 'No hay cuenta con el correo %. Pídele que entre una vez en pteron.patagua.dev/cuenta y repite.', p_correo;
  end if;

  if not exists (select 1 from public.plan_catalog where id = p_plan and active) then
    raise exception 'El plan "%" no existe o está inactivo. Los válidos: %',
      p_plan, (select string_agg(id, ', ' order by id) from public.plan_catalog where active);
  end if;

  -- Un índice único permite una sola suscripción vigente por usuario, así que
  -- la anterior se cierra antes de abrir la nueva. Si estaba pagando por Flow,
  -- esto NO cancela el cobro en Flow: hay que anularlo allá también.
  update public.subscriptions
     set status = 'canceled', canceled_at = now()
   where user_id = v_uid
     and status in ('incomplete', 'trialing', 'active', 'past_due', 'paused');

  insert into public.subscriptions
    (user_id, plan_id, provider, status, current_period_start, current_period_end)
  values
    (v_uid, p_plan, 'comp', 'active', now(), now() + make_interval(months => p_meses));

  return query
    select p_correo, p_plan, 'active'::text, now() + make_interval(months => p_meses);
end;
$$;

create or replace function admin.quitar_plan(p_correo text)
returns text
language plpgsql
as $$
declare v_filas integer;
begin
  update public.subscriptions s
     set status = 'canceled', canceled_at = now()
    from auth.users u
   where u.id = s.user_id
     and lower(u.email) = lower(trim(p_correo))
     and s.provider = 'comp'
     and s.status in ('trialing', 'active', 'past_due', 'paused');
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    return format('%s no tenía ninguna cortesía vigente.', p_correo);
  end if;
  return format('Cortesía retirada a %s.', p_correo);
end;
$$;

-- ── 4. Quién compra ──────────────────────────────────────────────────────
create or replace view admin.ventas as
select
  u.email                                    as correo,
  s.plan_id                                  as plan,
  case s.provider when 'comp' then 'cortesía' else 'pagado' end as tipo,
  case when s.provider = 'comp' then 0 else c.monthly_price_clp end as clp_mes,
  s.status                                   as estado,
  s.trial_ends_at                            as fin_prueba,
  s.current_period_end                       as fin_periodo,
  s.cancel_at_period_end                     as cancela_al_final,
  s.created_at                               as alta
from public.subscriptions s
join auth.users u on u.id = s.user_id
join public.plan_catalog c on c.id = s.plan_id
order by s.created_at desc;

create or replace view admin.resumen as
select
  count(*) filter (where estado in ('active', 'trialing') and tipo = 'pagado')   as pagando,
  count(*) filter (where estado in ('active', 'trialing') and tipo = 'cortesía') as cortesias,
  count(*) filter (where estado = 'trialing')                                   as en_prueba,
  coalesce(sum(clp_mes) filter (where estado = 'active' and tipo = 'pagado'), 0) as clp_mes_recurrente
from admin.ventas;

-- Nada de esto se sirve por la API; solo se consulta desde el editor SQL.
revoke all on all tables in schema admin from anon, authenticated;
revoke all on all functions in schema admin from anon, authenticated;
