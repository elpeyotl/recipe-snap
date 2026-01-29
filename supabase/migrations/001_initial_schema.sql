-- ============================================
-- Recipe Snap Database Schema
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  credits integer default 0 not null,
  total_snaps_used integer default 0 not null,
  stripe_customer_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Transactions table (payment/usage history)
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('purchase', 'usage', 'bonus', 'refund')),
  credits_change integer not null,
  amount numeric(10, 2),
  stripe_session_id text,
  pack_name text,
  created_at timestamp with time zone default now()
);

-- 3. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- 4. RLS Policies - users can only access their own data
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- 5. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Atomic credit deduction (returns true if successful)
create or replace function public.use_credit(user_id uuid)
returns boolean as $$
declare
  rows_updated integer;
begin
  update public.profiles
  set credits = credits - 1,
      total_snaps_used = total_snaps_used + 1,
      updated_at = now()
  where id = user_id and credits > 0;

  get diagnostics rows_updated = row_count;

  if rows_updated > 0 then
    insert into public.transactions (user_id, type, credits_change)
    values (user_id, 'usage', -1);
    return true;
  end if;

  return false;
end;
$$ language plpgsql security definer;

-- 7. Atomic credit addition (idempotent by stripe_session_id)
create or replace function public.add_credits(
  p_user_id uuid,
  p_credits integer,
  p_amount numeric,
  p_stripe_session_id text,
  p_pack_name text
)
returns boolean as $$
declare
  existing_count integer;
begin
  -- Check idempotency
  select count(*) into existing_count
  from public.transactions
  where stripe_session_id = p_stripe_session_id;

  if existing_count > 0 then
    return false; -- Already processed
  end if;

  -- Add credits
  update public.profiles
  set credits = credits + p_credits,
      updated_at = now()
  where id = p_user_id;

  -- Record transaction
  insert into public.transactions (user_id, type, credits_change, amount, stripe_session_id, pack_name)
  values (p_user_id, 'purchase', p_credits, p_amount, p_stripe_session_id, p_pack_name);

  return true;
end;
$$ language plpgsql security definer;

-- 8. Indexes for common queries
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_transactions_stripe_session on public.transactions(stripe_session_id);
