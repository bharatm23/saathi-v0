-- ============================================================
-- Saathi — Auth & Onboarding Tables
-- Run AFTER 001 and 002
-- ============================================================

-- User profiles (extends auth.users)
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  date_of_birth date,
  gender        text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Family members owned by a user
create table if not exists family_members (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users on delete cascade not null,
  name        text not null,
  relation    text,              -- 'parent' | 'sibling' | 'spouse' | 'child' | 'other'
  date_of_birth date,
  created_at  timestamptz default now()
);

-- RLS
alter table profiles       enable row level security;
alter table family_members enable row level security;

create policy "Users manage own profile"
  on profiles for all using (auth.uid() = id);

create policy "Users manage own family members"
  on family_members for all using (auth.uid() = owner_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Remove FK constraints on existing tables if not already done
-- (safe to run again — drops only if exists)
alter table if exists lab_reports
  drop constraint if exists lab_reports_user_id_fkey;
alter table if exists wearable_snapshots
  drop constraint if exists wearable_snapshots_user_id_fkey;
alter table if exists chat_messages
  drop constraint if exists chat_messages_user_id_fkey;
