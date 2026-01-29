-- Add settings JSONB column to profiles for cloud sync
alter table public.profiles
  add column if not exists settings jsonb default '{}'::jsonb;
