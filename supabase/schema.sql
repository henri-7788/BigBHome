-- WG Route Finder schema
-- Paste this into Supabase Dashboard → SQL Editor and run it.

create table if not exists wg_destinations (
  id         uuid        primary key,
  name       text        not null,
  address    text        not null,
  lat        float8      not null,
  lng        float8      not null,
  created_at timestamptz not null default now()
);

create table if not exists wg_listings (
  id                   uuid        primary key,
  url                  text        not null unique,
  listing_data         jsonb       not null,
  destination_journeys jsonb       not null default '[]'::jsonb,
  is_favorite          boolean     not null default false,
  created_at           timestamptz not null default now()
);

create table if not exists wg_suggestions (
  id           text        primary key,    -- WG-Gesucht numeric listing ID
  url          text        not null unique,
  listing_data jsonb,                      -- null when scraping was blocked
  destination_journeys jsonb not null default '[]'::jsonb,
  best_score   integer,
  is_dismissed boolean     not null default false,
  suggested_at timestamptz not null default now()
);
