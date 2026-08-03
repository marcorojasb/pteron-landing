-- Reserva atómica de cuota de IA para el gateway (ADR-055, PLAN-0.3.md P4).
-- PostgREST no puede incrementar de forma segura con un upsert simple: dos
-- llamadas concurrentes del mismo profesor podrían pasar juntas un chequeo
-- que sólo una debería pasar. Esta función bloquea la fila del período antes
-- de decidir, así que se serializan en vez de pisarse.
--
-- p_units en 0 sirve como chequeo previo sin registrar nada (se usa antes de
-- llamar al proveedor real); con el gasto ya conocido se llama de nuevo con
-- el total real de tokens.

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_plan_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_units integer,
  p_limit integer
)
returns table (allowed boolean, units_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id uuid;
  v_used integer;
begin
  insert into public.usage_periods (user_id, plan_id, period_start, period_end, ai_units_limit)
  values (p_user_id, p_plan_id, p_period_start, p_period_end, p_limit)
  on conflict (user_id, period_start) do nothing;

  select id, ai_units_used into v_period_id, v_used
  from public.usage_periods
  where user_id = p_user_id and period_start = p_period_start
  for update;

  if p_limit is not null and v_used + p_units > p_limit then
    return query select false, v_used;
    return;
  end if;

  if p_units > 0 then
    update public.usage_periods set ai_units_used = ai_units_used + p_units where id = v_period_id;
    insert into public.usage_events (user_id, period_id, event_type, units)
    values (p_user_id, v_period_id, 'gateway_chat_completion', p_units);
  end if;

  return query select true, v_used + p_units;
end;
$$;

-- Igual que handle_new_user: es infraestructura interna del gateway, nunca
-- una RPC que un cliente autenticado o anónimo pueda invocar directamente.
revoke execute on function public.reserve_ai_usage from public, anon, authenticated;
