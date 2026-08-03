-- pteron account, billing, activation and usage foundation.
-- No product content is stored here; only account and entitlement metadata.

create extension if not exists "pgcrypto";

create table public.plan_catalog (
  id text primary key,
  display_name text not null,
  monthly_price_clp integer not null check (monthly_price_clp >= 0),
  trial_period_days integer not null default 0 check (trial_period_days >= 0),
  ai_units_limit integer check (ai_units_limit is null or ai_units_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_catalog (id, display_name, monthly_price_clp, trial_period_days, ai_units_limit)
values
  ('free', 'Gratis', 0, 0, null),
  ('basic', 'Basic', 2999, 7, null),
  ('pro', 'Pro', 9990, 0, null)
on conflict (id) do update set
  display_name = excluded.display_name,
  monthly_price_clp = excluded.monthly_price_clp,
  trial_period_days = excluded.trial_period_days,
  ai_units_limit = excluded.ai_units_limit,
  active = true,
  updated_at = now();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plan_catalog(id),
  provider text not null default 'flow' check (provider = 'flow'),
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
  updated_at timestamptz not null default now()
);

create unique index subscriptions_one_current_per_user
  on public.subscriptions (user_id)
  where status in ('incomplete', 'trialing', 'active', 'past_due', 'paused');

create index subscriptions_user_id_idx on public.subscriptions (user_id);

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

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null references public.usage_periods(id) on delete cascade,
  event_type text not null,
  units integer not null default 1 check (units > 0),
  event_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index usage_periods_user_id_idx on public.usage_periods (user_id);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

create or replace function public.set_updated_at()
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

create trigger plan_catalog_set_updated_at
before update on public.plan_catalog
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger licenses_set_updated_at
before update on public.licenses
for each row execute function public.set_updated_at();

create trigger activation_intents_set_updated_at
before update on public.activation_intents
for each row execute function public.set_updated_at();

create trigger usage_periods_set_updated_at
before update on public.usage_periods
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.plan_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.licenses enable row level security;
alter table public.activation_intents enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_periods enable row level security;
alter table public.usage_events enable row level security;

create policy plan_catalog_public_read
on public.plan_catalog for select
using (active = true);

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

create policy activation_intents_update_own
on public.activation_intents for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy usage_periods_select_own
on public.usage_periods for select
using ((select auth.uid()) = user_id);

create policy usage_events_select_own
on public.usage_events for select
using ((select auth.uid()) = user_id);
