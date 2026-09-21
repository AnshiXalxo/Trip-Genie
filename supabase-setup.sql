-- ================================================
-- Trip Genie 2.0 — Supabase Database Setup
-- ================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all tables needed for the app.
-- ================================================

-- 1. USERS TABLE
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 2. TRIPS TABLE
create table if not exists trips (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  from_location text not null,
  to_location text not null,
  budget numeric not null default 0,
  people integer not null default 1,
  days integer not null default 1,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. TRIP MEMBERS (for multi-user trips)
create table if not exists trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(trip_id, user_id)
);

-- 4. EXPENSES
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  paid_by text not null,
  split_between integer not null default 1,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- 5. MESSAGES (chat)
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  sender_name text not null,
  text text not null,
  created_at timestamptz default now()
);

-- 6. MEDIA (memories)
create table if not exists media (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  url text not null,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- 7. ITINERARY ITEMS (AI planner)
create table if not exists itinerary_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  day_number integer not null default 1,
  time_slot text not null default 'morning',
  title text not null,
  description text,
  place text,
  item_type text not null default 'activity',
  order_index integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ================================================
-- DISABLE ROW LEVEL SECURITY (for simplicity)
-- Our Express server handles auth via JWT
-- ================================================
alter table users disable row level security;
alter table trips disable row level security;
alter table trip_members disable row level security;
alter table expenses disable row level security;
alter table messages disable row level security;
alter table media disable row level security;
alter table itinerary_items disable row level security;

-- ================================================
-- INDEXES for performance
-- ================================================
create index if not exists idx_trips_created_by on trips(created_by);
create index if not exists idx_trip_members_trip on trip_members(trip_id);
create index if not exists idx_trip_members_user on trip_members(user_id);
create index if not exists idx_expenses_trip on expenses(trip_id);
create index if not exists idx_messages_trip on messages(trip_id);
create index if not exists idx_media_trip on media(trip_id);
create index if not exists idx_itinerary_trip on itinerary_items(trip_id);


