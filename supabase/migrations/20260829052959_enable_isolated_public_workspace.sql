grant usage on schema public to anon;
grant select, insert, update, delete on table
  public.projects,
  public.sources,
  public.evidence,
  public.claims,
  public.claim_relations,
  public.insights,
  public.research_gaps,
  public.research_tasks,
  public.conflicts,
  public.timeline_events,
  public.search_results,
  public.embeddings
to anon;

create policy projects_public_workspace_all
on public.projects for all to anon
using (user_id = 'ede7bb1e-5ebc-4db9-8c8f-04f57c839c5e'::uuid)
with check (user_id = 'ede7bb1e-5ebc-4db9-8c8f-04f57c839c5e'::uuid);

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
      'create policy %I on public.%I for all to anon using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = %L::uuid)) with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = %L::uuid))',
      table_name || '_public_workspace_all',
      table_name,
      'ede7bb1e-5ebc-4db9-8c8f-04f57c839c5e',
      'ede7bb1e-5ebc-4db9-8c8f-04f57c839c5e'
    );
  end loop;
end $$;
