-- ============================================================
-- HOMIE — Supabase SQL Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- PROFILES (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  user_type text check (user_type in ('buyer', 'agent')),
  created_at timestamp with time zone default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- LISTINGS
create table if not exists listings (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  town text,
  region text,
  flat_type text,
  property_type text default 'hdb',
  listing_type text default 'sale',
  price integer,
  address text,
  floor_area_sqm numeric,
  storey_range text,
  lease_commence_date integer,
  num_bedrooms integer default 3,
  description text,
  lifestyle_tags text[],
  image_url text,
  status text default 'active',
  agent_id uuid references auth.users,
  location_area text,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default now()
);
alter table listings enable row level security;
create policy "Anyone can view active listings" on listings for select using (status = 'active');
create policy "Agents can manage own listings" on listings for all using (auth.uid() = agent_id);

-- LIFESTYLE PROFILES
create table if not exists lifestyle_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  budget_min integer default 300000,
  budget_max integer default 800000,
  preferred_towns jsonb default '[]',
  important_places jsonb default '[]',
  num_bedrooms integer default 3,
  property_type text default 'any',
  mrt_enabled boolean default false, mrt_minutes integer default 10,
  bus_enabled boolean default false, bus_minutes integer default 5,
  parks_enabled boolean default false, parks_minutes integer default 10, parks_mode text default 'walk',
  schools_enabled boolean default false, schools_minutes integer default 10, schools_mode text default 'walk',
  hawker_enabled boolean default false, hawker_minutes integer default 10, hawker_mode text default 'walk',
  supermarket_enabled boolean default false, supermarket_minutes integer default 10, supermarket_mode text default 'walk',
  hospital_enabled boolean default false, hospital_minutes integer default 15, hospital_mode text default 'commute',
  polyclinic_enabled boolean default false, polyclinic_minutes integer default 15, polyclinic_mode text default 'commute',
  created_at timestamp with time zone default now()
);
alter table lifestyle_profiles enable row level security;
create policy "Users manage own lifestyle profile" on lifestyle_profiles for all using (auth.uid() = user_id);

-- SWIPES
create table if not exists swipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  listing_id uuid references listings on delete cascade,
  direction text check (direction in ('left', 'right')),
  created_at timestamp with time zone default now(),
  unique(user_id, listing_id)
);
alter table swipes enable row level security;
create policy "Users manage own swipes" on swipes for all using (auth.uid() = user_id);

-- MATCHES
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references auth.users on delete cascade,
  agent_id uuid references auth.users,
  listing_id uuid references listings on delete cascade,
  compatibility_score integer,
  listing_title text,
  buyer_name text,
  status text default 'active',
  created_at timestamp with time zone default now()
);
alter table matches enable row level security;
create policy "Buyers see own matches" on matches for select using (auth.uid() = buyer_id);
create policy "Agents see own matches" on matches for select using (auth.uid() = agent_id);
create policy "Buyers create matches" on matches for insert with check (auth.uid() = buyer_id);

-- CHAT MESSAGES
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches on delete cascade,
  user_id uuid references auth.users on delete cascade,
  content text not null,
  sender_name text,
  created_at timestamp with time zone default now()
);
alter table chat_messages enable row level security;
create policy "Match participants can see messages" on chat_messages for select
  using (
    exists (
      select 1 from matches
      where matches.id = chat_messages.match_id
      and (matches.buyer_id = auth.uid() or matches.agent_id = auth.uid())
    )
  );
create policy "Users can send messages" on chat_messages for insert
  with check (auth.uid() = user_id);

-- PROPERTY NOTES
create table if not exists property_notes (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches on delete cascade,
  user_id uuid references auth.users on delete cascade,
  content text,
  created_at timestamp with time zone default now()
);
alter table property_notes enable row level security;
create policy "Users manage own notes" on property_notes for all using (auth.uid() = user_id);

-- STORAGE BUCKET for file uploads
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true)
  on conflict do nothing;
create policy "Anyone can upload" on storage.objects for insert with check (bucket_id = 'uploads');
create policy "Anyone can view uploads" on storage.objects for select using (bucket_id = 'uploads');
