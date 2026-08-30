alter table public.sources
  add column if not exists document_type text not null default 'unknown',
  add column if not exists authors text[] not null default '{}',
  add column if not exists publisher text not null default '',
  add column if not exists journal text not null default '',
  add column if not exists doi text not null default '',
  add column if not exists citation_count integer,
  add column if not exists reference_count integer,
  add column if not exists cited_by_url text not null default '',
  add column if not exists pdf_url text not null default '',
  add column if not exists citation_text text not null default '',
  add column if not exists metadata_provider text not null default 'page',
  add column if not exists peer_review_status text not null default 'unknown',
  add column if not exists authenticity_score integer not null default 0,
  add column if not exists authenticity_tier text not null default 'unverified',
  add column if not exists authenticity_signals jsonb not null default '[]'::jsonb,
  add column if not exists bibliography_entries jsonb not null default '[]'::jsonb;

alter table public.sources
  add constraint sources_document_type_check check (document_type in (
    'journal_article', 'conference_paper', 'preprint', 'thesis',
    'book_chapter', 'technical_report', 'government_report', 'dataset',
    'documentation', 'news_article', 'blog_post', 'webpage', 'pdf', 'unknown'
  )),
  add constraint sources_peer_review_status_check check (peer_review_status in ('likely', 'unknown', 'not_applicable')),
  add constraint sources_authenticity_score_check check (authenticity_score between 0 and 100),
  add constraint sources_authenticity_tier_check check (authenticity_tier in ('verified', 'strong', 'moderate', 'weak', 'unverified')),
  add constraint sources_citation_count_check check (citation_count is null or citation_count >= 0),
  add constraint sources_reference_count_check check (reference_count is null or reference_count >= 0);

create index if not exists sources_project_authenticity_idx
  on public.sources (project_id, authenticity_score desc);

create unique index if not exists sources_project_doi_unique_idx
  on public.sources (project_id, lower(doi))
  where doi <> '';

update public.sources
set
  document_type = case source_type::text
    when 'research paper' then 'journal_article'
    when 'report' then 'technical_report'
    when 'dataset' then 'dataset'
    when 'documentation' then 'documentation'
    when 'news' then 'news_article'
    when 'blog' then 'blog_post'
    else 'webpage'
  end,
  authors = case when author <> '' and author <> 'Unknown author' then array[author] else '{}'::text[] end,
  authenticity_score = quality_score,
  authenticity_tier = case
    when quality_score >= 75 then 'strong'
    when quality_score >= 50 then 'moderate'
    when quality_score >= 25 then 'weak'
    else 'unverified'
  end,
  authenticity_signals = jsonb_build_array('Legacy source score retained; capture again to verify scholarly metadata.'),
  citation_text = concat(author, ' (', coalesce(extract(year from publication_date)::text, 'n.d.'), '). ', title, '. ', url)
where metadata_provider = 'page' and authenticity_score = 0;
