-- ============================================================
-- Saathi Phase 0 — pgvector RPC Functions
-- Run AFTER 001_core_tables.sql
-- These are called by the Python backend via supabase.rpc()
-- ============================================================

-- Match lab reports by vector similarity for a specific user
create or replace function match_lab_reports(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int default 3
)
returns table (
  id              uuid,
  report_date     date,
  lab_name        text,
  structured_data jsonb,
  raw_text        text,
  similarity      float
)
language sql stable
as $$
  select
    id,
    report_date,
    lab_name,
    structured_data,
    raw_text,
    1 - (embedding <=> query_embedding) as similarity
  from lab_reports
  where user_id = match_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Match wearable snapshots by vector similarity for a specific user
create or replace function match_wearable_snapshots(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int default 5
)
returns table (
  id               uuid,
  date             date,
  steps            integer,
  resting_hr       integer,
  sleep_hours      float,
  sleep_efficiency float,
  similarity       float
)
language sql stable
as $$
  select
    id,
    date,
    steps,
    resting_hr,
    sleep_hours,
    sleep_efficiency,
    1 - (embedding <=> query_embedding) as similarity
  from wearable_snapshots
  where user_id = match_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
