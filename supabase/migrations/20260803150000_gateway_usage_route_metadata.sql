-- reserve_ai_usage gana un parámetro de metadata para poder anotar qué
-- modelo real respondió detrás del gateway (ADR-056: "la aplicación siempre
-- puede responder qué modelo usó y por qué"). El cliente sólo pide el id
-- virtual "pteron-managed" (ADR-056 permite ocultar el nombre en la
-- superficie principal), así que sin esto la respuesta real se perdía.
--
-- Se recrea la función completa porque Postgres no permite agregar un
-- parámetro con default a una función existente sin cambiar su firma; el
-- default deja compatibles a las llamadas ya emitidas antes de este cambio.

drop function if exists public.reserve_ai_usage(uuid, text, timestamptz, timestamptz, integer, integer);

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_plan_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_units integer,
  p_limit integer,
  p_metadata jsonb default '{}'::jsonb
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
    insert into public.usage_events (user_id, period_id, event_type, units, event_metadata)
    values (p_user_id, v_period_id, 'gateway_chat_completion', p_units, coalesce(p_metadata, '{}'::jsonb));
  end if;

  return query select true, v_used + p_units;
end;
$$;

revoke execute on function public.reserve_ai_usage from public, anon, authenticated;
