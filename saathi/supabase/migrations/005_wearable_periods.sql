create table wearable_period_summaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  period      text not null,        -- '30d' | '1y'
  sync_date   date not null,        -- anchor date of the fetch
  source      text not null default 'fitbit',
  metrics     jsonb not null,       -- { steps_avg, steps_min, steps_max, sleep_avg... }
  cached_at   timestamptz default now(),
  unique (user_id, period, sync_date, source)
);

alter table wearable_period_summaries enable row level security;
create policy "Users access own period summaries"
  on wearable_period_summaries for all using (auth.uid() = user_id);