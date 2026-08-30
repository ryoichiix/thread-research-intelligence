# THREAD Supabase schema

The complete executable schema is in:

- `migrations/20260828045938_create_thread_research_schema.sql`
- `migrations/20260828090000_remove_demo_records.sql`
- `migrations/20260828093320_backfill_user_profiles_and_repair_trigger.sql`
- `migrations/20260828163554_add_source_intelligence.sql`

It creates 13 RLS-protected public tables:

1. `users` - application profile linked to `auth.users`.
2. `projects` - research projects owned through `user_id`.
3. `sources` - source metadata, document classification, authorship, DOI, venue, citation signals, extracted bibliography, authenticity assessment, quality, freshness, and limitations.
4. `evidence` - captured excerpts, provenance, stance, method, and confidence.
5. `claims` - normalized claims with supporting evidence IDs.
6. `claim_relations` - supports, contradicts, expands, depends-on, related, and duplicate edges.
7. `insights` - provenance-backed research insights.
8. `research_gaps` - coverage gaps and suggested investigations.
9. `research_tasks` - ranked next-research tasks.
10. `conflicts` - supporting and contradicting evidence comparisons.
11. `timeline_events` - chronological changes in understanding.
12. `search_results` - Tavily discovery results and review state.
13. `embeddings` - pgvector embeddings for semantic retrieval.

All project data is protected by ownership policies based on `auth.uid() = projects.user_id`. The `anon` database role has no table access. Production and the current local configuration use Supabase Auth with `GUEST_MODE=false`; the ignored `.thread/guest-data.json` store remains available only when guest mode is explicitly enabled for isolated development.

## Source intelligence

The source-intelligence migration records:

- document type and metadata provider;
- author list, publisher, journal, publication date, DOI, PDF URL, and canonical citation;
- Google Scholar cited-by count/link and detected bibliography entries;
- an explainable authenticity score/tier with stored positive and negative signals;
- a cautious peer-review status (`likely`, `unknown`, or `not_applicable`).

The authenticity score is a provenance and traceability aid. It does not certify that a source is true, unbiased, or methodologically sound.
