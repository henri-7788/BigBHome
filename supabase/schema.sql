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

-- Commute Heatmap
-- Destinations with a weekly schedule + weight (unlike wg_destinations, which has neither).
create table if not exists commute_destinations (
  id         uuid        primary key,
  name       text        not null,
  address    text        not null,
  lat        float8      not null,
  lng        float8      not null,
  weight     int         not null default 50,
  schedule   jsonb       not null default '[]'::jsonb, -- CommuteScheduleEntry[]
  created_at timestamptz not null default now()
);

-- Cached OTP travel times per grid cell x destination x schedule entry.
-- cell_id is deterministic (see src/lib/commute/grid.ts) so cache stays valid across recomputes
-- as long as COMMUTE_GRID_SPACING_METERS doesn't change.
create table if not exists commute_travel_times (
  cell_id           text        not null,
  destination_id    uuid        not null references commute_destinations(id) on delete cascade,
  weekday           int         not null, -- 1 (Monday) - 7 (Sunday)
  target_time       text        not null, -- HH:MM
  duration_minutes  int,
  transfers         int,
  legs              jsonb,      -- JourneyLeg[]
  computed_at       timestamptz not null default now(),
  primary key (cell_id, destination_id, weekday, target_time)
);

-- Tracks progress of a grid recompute job so the UI can poll it.
create table if not exists commute_jobs (
  id             uuid        primary key,
  status         text        not null default 'pending', -- pending | running | done | error
  total_cells    int         not null default 0,
  completed_cells int        not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
