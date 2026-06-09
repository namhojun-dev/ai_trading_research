create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  plan text not null default 'FREE' check (plan in ('FREE', 'PREMIUM', 'VIP')),
  created_at timestamptz not null default now()
);

create table if not exists public.assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona text not null default 'future_self',
  name text not null,
  personality text not null,
  voice text not null,
  avatar text,
  level integer not null default 1 check (level between 1 and 100),
  experience integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  deadline timestamptz not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  value numeric not null,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.life_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  token_hash text,
  platform text not null check (platform in ('ios', 'android', 'web')),
  provider text not null default 'fcm' check (provider in ('fcm')),
  encrypted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens add column if not exists token_hash text;
alter table public.push_tokens add column if not exists encrypted boolean not null default false;

create table if not exists public.character_rewards (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references public.assistants(id) on delete cascade,
  type text not null check (type in ('background', 'item', 'evolution', 'experience')),
  title text not null,
  unlocked_at timestamptz not null default now()
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_time text not null,
  end_time text not null,
  title text not null,
  intent text not null,
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('FREE', 'PREMIUM', 'VIP')),
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_checkout_session_id text,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_deadline_idx on public.goals(user_id, deadline);
create index if not exists behavior_logs_user_created_idx on public.behavior_logs(user_id, created_at desc);
create index if not exists behavior_logs_user_type_idx on public.behavior_logs(user_id, type);
create index if not exists notifications_user_sent_idx on public.notifications(user_id, sent_at desc);
create index if not exists push_tokens_user_created_idx on public.push_tokens(user_id, created_at desc);
create unique index if not exists push_tokens_user_token_hash_unique_idx on public.push_tokens(user_id, token_hash);
create index if not exists character_rewards_assistant_idx on public.character_rewards(assistant_id, unlocked_at desc);
create index if not exists schedule_blocks_user_created_idx on public.schedule_blocks(user_id, created_at desc);
create index if not exists subscriptions_user_created_idx on public.subscriptions(user_id, created_at desc);
create index if not exists subscriptions_provider_subscription_idx on public.subscriptions(provider_subscription_id);

alter table public.users enable row level security;
alter table public.assistants enable row level security;
alter table public.goals enable row level security;
alter table public.behavior_logs enable row level security;
alter table public.life_scores enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.character_rewards enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can read themselves" on public.users
  for select using (auth.uid() = id);

create policy "Users own assistants" on public.assistants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own behavior logs" on public.behavior_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own life scores" on public.life_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own push tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own character rewards" on public.character_rewards
  for all using (
    exists (
      select 1 from public.assistants
      where assistants.id = character_rewards.assistant_id
      and assistants.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.assistants
      where assistants.id = character_rewards.assistant_id
      and assistants.user_id = auth.uid()
    )
  );

create policy "Users own schedule blocks" on public.schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('assistant-avatars', 'assistant-avatars', true)
on conflict (id) do nothing;

create policy "Users manage assistant avatars" on storage.objects
  for all using (
    bucket_id = 'assistant-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'assistant-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
