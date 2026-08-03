-- Short-lived server-side state for Flow's card-registration redirect.
-- Card numbers, security codes and Flow tokens are never persisted here.

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
  updated_at timestamptz not null default now()
);

create index billing_checkout_intents_user_idx
  on public.billing_checkout_intents (user_id, created_at desc);

create index billing_checkout_intents_active_idx
  on public.billing_checkout_intents (status, expires_at);

create trigger billing_checkout_intents_set_updated_at
before update on public.billing_checkout_intents
for each row execute function public.set_updated_at();

alter table public.billing_checkout_intents enable row level security;

-- This table is deliberately server-only. RLS remains default-deny for the
-- browser; the Vercel function uses the Supabase service role for mutations.
