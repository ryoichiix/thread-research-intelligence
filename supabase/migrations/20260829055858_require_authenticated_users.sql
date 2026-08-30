drop policy if exists projects_public_workspace_all on public.projects;
drop policy if exists sources_public_workspace_all on public.sources;
drop policy if exists evidence_public_workspace_all on public.evidence;
drop policy if exists claims_public_workspace_all on public.claims;
drop policy if exists claim_relations_public_workspace_all on public.claim_relations;
drop policy if exists insights_public_workspace_all on public.insights;
drop policy if exists research_gaps_public_workspace_all on public.research_gaps;
drop policy if exists research_tasks_public_workspace_all on public.research_tasks;
drop policy if exists conflicts_public_workspace_all on public.conflicts;
drop policy if exists timeline_events_public_workspace_all on public.timeline_events;
drop policy if exists search_results_public_workspace_all on public.search_results;
drop policy if exists embeddings_public_workspace_all on public.embeddings;

revoke all on all tables in schema public from anon;
revoke usage on schema public from anon;
