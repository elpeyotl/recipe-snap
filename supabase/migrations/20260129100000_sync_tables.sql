-- ============================================
-- Favorites & Search History tables for cloud sync
-- ============================================

-- Favorites table
create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recipe_name text not null,
  recipe_data jsonb not null,
  created_at timestamp with time zone default now(),
  unique(user_id, recipe_name)
);

-- Search history table
create table public.search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ingredients text[] not null,
  recipes jsonb not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.favorites enable row level security;
alter table public.search_history enable row level security;

-- Favorites RLS policies
create policy "Users can read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- Search history RLS policies
create policy "Users can read own search_history"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own search_history"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own search_history"
  on public.search_history for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_favorites_user_id on public.favorites(user_id);
create index idx_favorites_created_at on public.favorites(user_id, created_at desc);
create index idx_search_history_user_id on public.search_history(user_id);
create index idx_search_history_created_at on public.search_history(user_id, created_at desc);
