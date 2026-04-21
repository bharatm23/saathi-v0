-- ============================================================
-- Saathi Phase 0 — Core Tables
-- Run in Supabase SQL editor in this order
-- ============================================================

-- Enable pgvector extension (required for RAG)
create extension if not exists vector;

-- ── Lab Reports ──────────────────────────────────────────────
-- Stores every uploaded lab report per user.
-- structured_data is fully dynamic — no fixed schema for metrics.
-- The LLM extracts whatever fields exist in the actual report.
create table if not exists lab_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  uploaded_at     timestamptz default now(),
  report_date     date,
  lab_name        text,
  file_name       text,
  raw_text        text,                    -- full OCR output from LlamaParse
  structured_data jsonb default '{}',     -- dynamic: {HbA1c: {value: 6.8, unit: "%"}, LDL: {...}}
  embedding       vector(1536),           -- for RAG similarity search
  source          text default 'upload'   -- 'upload' | 'whatsapp'
);

-- Index for fast user-scoped retrieval
create index if not exists lab_reports_user_id_idx on lab_reports(user_id);
create index if not exists lab_reports_date_idx    on lab_reports(user_id, report_date desc);

-- pgvector index for similarity search
create index if not exists lab_reports_embedding_idx
  on lab_reports using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ── Wearable Snapshots ───────────────────────────────────────
-- One row per user per day, written by the Fitbit sync job.
-- All metric columns are nullable — only populated if available.
create table if not exists wearable_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  date            date not null,
  source          text default 'fitbit',   -- 'fitbit' | 'google_fit' | 'manual'
  steps           integer,
  calories        integer,
  distance_km     float,
  active_minutes  integer,
  resting_hr      integer,
  sleep_hours     float,
  sleep_efficiency float,                  -- 0-100%
  weight_kg       float,
  raw_data        jsonb default '{}',      -- full provider response stored here
  embedding       vector(1536),
  unique(user_id, date, source)
);

create index if not exists wearable_user_date_idx
  on wearable_snapshots(user_id, date desc);

create index if not exists wearable_embedding_idx
  on wearable_snapshots using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ── Chat History ─────────────────────────────────────────────
-- Stores every user message and Saathi response for context continuity.
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  created_at  timestamptz default now(),
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  sources     jsonb default '[]',   -- [{type: 'lab_report', id: '...', date: '...'}]
  was_blocked boolean default false -- true if medical guard intercepted this
);

create index if not exists chat_user_idx on chat_messages(user_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────
-- Users can only ever read/write their own rows.
alter table lab_reports       enable row level security;
alter table wearable_snapshots enable row level security;
alter table chat_messages      enable row level security;

create policy "Users access own lab reports"
  on lab_reports for all
  using (auth.uid() = user_id);

create policy "Users access own wearable data"
  on wearable_snapshots for all
  using (auth.uid() = user_id);

create policy "Users access own chat history"
  on chat_messages for all
  using (auth.uid() = user_id);
