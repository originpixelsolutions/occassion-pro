-- Migration 074: User Device Tokens
-- Stores Expo push notification tokens per user for mobile push delivery.

create table if not exists public.user_device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, token)
);

-- Index for looking up all tokens for a user (to send pushes)
create index if not exists idx_device_tokens_user_id
  on public.user_device_tokens(user_id);

-- Index for tenant-wide token lookups
create index if not exists idx_device_tokens_tenant_id
  on public.user_device_tokens(tenant_id);

-- RLS: users can only manage their own tokens
alter table public.user_device_tokens enable row level security;

create policy "users manage own tokens"
  on public.user_device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all tokens (needed for push delivery from API)
create policy "service role full access"
  on public.user_device_tokens
  for all
  to service_role
  using (true)
  with check (true);
