-- Archimedes Database Schema
-- Run this in your Supabase SQL editor to set up all tables

-- Papers table
create table if not exists papers (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  abstract text not null,
  claims text,
  research_gap text,
  source_url text,
  created_at timestamp with time zone default now()
);

-- Experiments table
create table if not exists experiments (
  id uuid default gen_random_uuid() primary key,
  paper_id uuid references papers(id) on delete cascade,
  title text not null,
  hypothesis text not null,
  study_design text,
  funding_goal numeric default 0,
  funded_amount numeric default 0,
  upvotes integer default 0,
  downvotes integer default 0,
  tags text[] default '{}',
  status text default 'proposed' check (status in ('pending_review', 'proposed', 'rejected', 'funded', 'in_progress', 'completed')),
  novelty_score numeric,
  created_at timestamp with time zone default now()
);

-- Modules table
create table if not exists modules (
  id uuid default gen_random_uuid() primary key,
  experiment_id uuid references experiments(id) on delete cascade,
  module_name text not null,
  description text,
  expertise_required text,
  status text default 'open' check (status in ('open', 'claimed', 'in_progress', 'completed')),
  assigned_lab text,
  claimed_by text,
  created_at timestamp with time zone default now()
);

-- Votes table
create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  experiment_id uuid references experiments(id) on delete cascade,
  vote_type text not null check (vote_type in ('up', 'down')),
  session_id text not null,
  created_at timestamp with time zone default now(),
  unique (experiment_id, session_id)
);

-- Indexes for performance
create index if not exists idx_experiments_paper_id on experiments(paper_id);
create index if not exists idx_experiments_status on experiments(status);
create index if not exists idx_experiments_created_at on experiments(created_at desc);
create index if not exists idx_experiments_upvotes on experiments(upvotes desc);
create index if not exists idx_experiments_tags on experiments using gin(tags);
create index if not exists idx_modules_experiment_id on modules(experiment_id);
create index if not exists idx_votes_experiment_session on votes(experiment_id, session_id);

-- Enable full text search on experiments for hypothesis novelty checking
alter table experiments add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(hypothesis, ''))) stored;
create index if not exists idx_experiments_fts on experiments using gin(fts);

-- Comments table (threaded)
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  experiment_id uuid references experiments(id) on delete cascade not null,
  parent_id uuid references comments(id) on delete cascade,
  session_id text not null,
  author_name text not null default 'Anonymous',
  body text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_comments_experiment_id on comments(experiment_id);
create index if not exists idx_comments_parent_id on comments(parent_id);
create index if not exists idx_comments_created_at on comments(created_at);

-- Module claims table (links sessions to volunteered modules)
create table if not exists module_claims (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references modules(id) on delete cascade not null,
  session_id text not null,
  lab_name text not null,
  contact_email text,
  claimed_at timestamp with time zone default now(),
  unique (module_id, session_id)
);

create index if not exists idx_module_claims_session on module_claims(session_id);
create index if not exists idx_module_claims_module on module_claims(module_id);

-- Samples table (individual work items within a module)
create table if not exists samples (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references modules(id) on delete cascade not null,
  sample_name text not null,
  description text,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists idx_samples_module on samples(module_id);

-- Per-sample file uploads
alter table samples add column if not exists file_urls text[] default '{}';

-- Budget allocation columns on modules (AI-determined)
alter table modules add column if not exists budget_pct numeric;
alter table modules add column if not exists budget_rationale text;

-- Rejection countdown: track when a study was rejected so it auto-deletes after 1 hour
alter table experiments add column if not exists rejected_at timestamp with time zone;

-- Data submissions table (lab results for a module)
create table if not exists data_submissions (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references modules(id) on delete cascade not null,
  session_id text not null,
  submitted_by_lab text not null,
  submission_type text default 'results' check (submission_type in ('results', 'partial', 'failed')),
  results_summary text,
  results_data jsonb default '{}',
  file_urls text[] default '{}',
  notes text,
  submitted_at timestamp with time zone default now()
);

create index if not exists idx_data_submissions_module on data_submissions(module_id);
create index if not exists idx_data_submissions_session on data_submissions(session_id);

-- Row Level Security (disabled for demo — no auth)
alter table papers enable row level security;
alter table experiments enable row level security;
alter table modules enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;

-- Allow all operations for demo (anon key)
create policy "Allow all on papers" on papers for all using (true) with check (true);
create policy "Allow all on experiments" on experiments for all using (true) with check (true);
create policy "Allow all on modules" on modules for all using (true) with check (true);
create policy "Allow all on votes" on votes for all using (true) with check (true);
create policy "Allow all on comments" on comments for all using (true) with check (true);
alter table module_claims enable row level security;
create policy "Allow all on module_claims" on module_claims for all using (true) with check (true);
alter table samples enable row level security;
create policy "Allow all on samples" on samples for all using (true) with check (true);
alter table data_submissions enable row level security;
create policy "Allow all on data_submissions" on data_submissions for all using (true) with check (true);
