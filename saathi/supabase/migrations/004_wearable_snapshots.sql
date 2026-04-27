drop table if exists wearable_snapshots;

create table wearable_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  date             date not null,
  source           text not null default 'fitbit',
  steps            integer,
  calories         integer,
  distance_km      numeric(6,3),
  active_minutes   integer,
  resting_hr       integer,
  sleep_hours      numeric(4,2),
  sleep_efficiency integer,
  weight_kg        numeric(5,2),
  raw_data         jsonb,
  embedding        vector(1536),
  created_at       timestamptz default now(),
  unique (user_id, date, source)
);

alter table wearable_snapshots enable row level security;
create policy "Users access own snapshots"
  on wearable_snapshots for all using (auth.uid() = user_id);