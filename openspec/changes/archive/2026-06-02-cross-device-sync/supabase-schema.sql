-- =============================================================
-- Supabase Schema: Álbum Mundial 48 — Cross-Device Sync
-- Run this in your Supabase SQL Editor (dashboard > SQL Editor)
-- =============================================================

-- 1. PROFILES TABLE
-- Stores user metadata synced from Google OAuth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. COLLECTION ITEMS TABLE
-- Stores per-card counts with timestamps for conflict resolution
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, card_id)
);

-- Index for fast lookups by user
create index if not exists idx_collection_items_user_id
  on public.collection_items(user_id);

-- Index for conflict resolution queries
create index if not exists idx_collection_items_user_card
  on public.collection_items(user_id, card_id);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table public.profiles enable row level security;
alter table public.collection_items enable row level security;

-- PROFILES POLICIES
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- COLLECTION ITEMS POLICIES
create policy "Users can read own items"
  on public.collection_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own items"
  on public.collection_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own items"
  on public.collection_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own items"
  on public.collection_items for delete
  using (auth.uid() = user_id);

-- =============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- =============================================================

-- Automatically create a profile row when a user signs up via Google
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Trigger fires after insert on auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
