create extension if not exists vector with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  research_question text not null check (char_length(research_question) between 10 and 500),
  description text not null default '',
  tags text[] not null default '{}',
  evidence_target integer not null default 20 check (evidence_target > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.evidence_type as enum (
  'research paper', 'article', 'documentation', 'report', 'dataset',
  'news', 'blog', 'opinion', 'unknown'
);
create type public.evidence_stance as enum ('supports', 'contradicts', 'neutral', 'unclear');
create type public.claim_relation_type as enum (
  'SUPPORTS', 'CONTRADICTS', 'EXPANDS', 'DEPENDS_ON', 'RELATED_TO', 'DUPLICATES'
);
create type public.insight_type as enum (
  'EMERGING_PATTERN', 'CONTRADICTION', 'KNOWLEDGE_GAP',
  'SIGNIFICANT_FINDING', 'WEAK_EVIDENCE', 'NEW_CONNECTION'
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  url text not null,
  domain text not null,
  source_type public.evidence_type not null default 'unknown',
  author text not null default 'Unknown author',
  publication_date date,
  summary text not null default '',
  limitations jsonb not null default '[]'::jsonb,
  quality_score integer not null default 50 check (quality_score between 0 and 100),
  freshness_score integer not null default 50 check (freshness_score between 0 and 100),
  discovered_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, url)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  selected_text text not null,
  surrounding_context text not null default '',
  page_title text not null,
  url text not null,
  author text not null default 'Unknown author',
  publication_date date,
  captured_at timestamptz not null default now(),
  evidence_type public.evidence_type not null default 'unknown',
  extracted_claim text not null,
  summary text not null default '',
  stance public.evidence_stance not null default 'unclear',
  confidence real not null default 0.5 check (confidence between 0 and 1),
  methodology text not null default '',
  limitations jsonb not null default '[]'::jsonb,
  topic text not null default 'Unclassified',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null,
  confidence real not null default 0.5 check (confidence between 0 and 1),
  topic text not null default 'Unclassified',
  entities text[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.claim_relations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_claim_id uuid not null references public.claims(id) on delete cascade,
  to_claim_id uuid not null references public.claims(id) on delete cascade,
  type public.claim_relation_type not null,
  confidence real not null default 0.5 check (confidence between 0 and 1),
  rationale text not null default '',
  created_at timestamptz not null default now(),
  check (from_claim_id <> to_claim_id),
  unique (from_claim_id, to_claim_id, type)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type public.insight_type not null,
  title text not null,
  description text not null,
  confidence real not null check (confidence between 0 and 1),
  supporting_evidence uuid[] not null check (cardinality(supporting_evidence) > 0),
  contradicting_evidence uuid[] not null default '{}',
  related_claims uuid[] not null default '{}',
  recommended_action text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.research_gaps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic text not null,
  coverage integer not null check (coverage between 0 and 100),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  confidence real not null check (confidence between 0 and 1),
  why_it_matters text not null,
  suggested_questions text[] not null default '{}',
  suggested_searches text[] not null default '{}',
  is_largest boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, topic)
);

create table public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  reason text not null,
  expected_value text not null check (expected_value in ('High', 'Medium', 'Low')),
  evidence_available integer not null default 0 check (evidence_available >= 0),
  missing_evidence text not null,
  suggested_searches text[] not null default '{}',
  status text not null default 'recommended' check (status in ('recommended', 'investigating', 'complete')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conflicts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic text not null,
  title text not null,
  status text not null check (status in ('SUPPORTED', 'CONTRADICTED', 'PARTIALLY_SUPPORTED', 'TENSION', 'INCONCLUSIVE', 'UNRELATED')),
  severity text not null check (severity in ('major', 'moderate', 'minor')),
  resolution text not null default 'unresolved' check (resolution in ('resolved', 'unresolved')),
  supporting_evidence uuid[] not null default '{}',
  contradicting_evidence uuid[] not null default '{}',
  explanation text[] not null default '{}',
  confidence real not null check (confidence between 0 and 1),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null,
  title text not null,
  description text not null,
  evidence_ids uuid[] not null default '{}',
  is_demo boolean not null default false
);

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  title text not null,
  snippet text not null default '',
  query text not null,
  discovered_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'saved', 'rejected')),
  unique (project_id, url, query)
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('source', 'evidence', 'claim', 'insight', 'gap')),
  entity_id uuid not null,
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, content_hash)
);

create index projects_user_updated_idx on public.projects (user_id, updated_at desc);
create index sources_project_type_idx on public.sources (project_id, source_type);
create index evidence_project_captured_idx on public.evidence (project_id, captured_at desc);
create index evidence_project_topic_stance_idx on public.evidence (project_id, topic, stance);
create index evidence_source_idx on public.evidence (source_id);
create index claims_project_topic_idx on public.claims (project_id, topic);
create index claim_relations_project_type_idx on public.claim_relations (project_id, type);
create index claim_relations_from_idx on public.claim_relations (from_claim_id);
create index claim_relations_to_idx on public.claim_relations (to_claim_id);
create index insights_project_created_idx on public.insights (project_id, created_at desc);
create index gaps_project_coverage_idx on public.research_gaps (project_id, coverage asc);
create index tasks_project_status_value_idx on public.research_tasks (project_id, status, expected_value);
create index conflicts_project_resolution_idx on public.conflicts (project_id, resolution, severity);
create index timeline_project_occurred_idx on public.timeline_events (project_id, occurred_at desc);
create index search_results_project_status_idx on public.search_results (project_id, status, discovered_at desc);
create index embeddings_project_entity_idx on public.embeddings (project_id, entity_type, entity_id);

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.sources enable row level security;
alter table public.evidence enable row level security;
alter table public.claims enable row level security;
alter table public.claim_relations enable row level security;
alter table public.insights enable row level security;
alter table public.research_gaps enable row level security;
alter table public.research_tasks enable row level security;
alter table public.conflicts enable row level security;
alter table public.timeline_events enable row level security;
alter table public.search_results enable row level security;
alter table public.embeddings enable row level security;

create policy users_self_select on public.users for select to authenticated
  using ((select auth.uid()) = id);
create policy users_self_update on public.users for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy projects_owner_all on public.projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sources', 'evidence', 'claims', 'claim_relations', 'insights',
    'research_gaps', 'research_tasks', 'conflicts', 'timeline_events',
    'search_results', 'embeddings'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))',
      table_name || '_owner_all',
      table_name
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();
