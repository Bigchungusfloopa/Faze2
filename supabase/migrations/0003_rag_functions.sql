-- 0003_rag_functions.sql
--
-- The two functions the RAG module runs on:
--   claim_document_for_ingestion() -- the idempotency guarantee
--   hybrid_search_chunks()         -- vector + full-text, fused by RRF
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_rag_functions.sql

begin;

-- ---------------------------------------------------------------------------
-- claim_document_for_ingestion
--
-- THIS is the idempotency guarantee for the ingestion pipeline. It is a single
-- atomic UPDATE with the state as a predicate, so two concurrent workers
-- cannot both win: the second one's UPDATE matches zero rows and it exits.
--
-- It claims a document that is:
--   * queued, or
--   * failed with retries left, or
--   * processing but stale -- a worker crashed mid-run and left it claimed.
--     15 minutes is the reclaim window.
--
-- Returns true if this caller won the claim.
-- ---------------------------------------------------------------------------
create or replace function public.claim_document_for_ingestion(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  update public.documents
     set status            = 'processing',
         stage             = 'classifying',
         progress_pct      = 5,
         attempts          = attempts + 1,
         ingest_started_at = now(),
         error             = null,
         updated_at        = now()
   where id = p_document_id
     and (
          status = 'queued'
       or (status = 'failed'     and attempts < 3)
       or (status = 'processing' and ingest_started_at < now() - interval '15 minutes')
     );

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end
$$;

revoke all on function public.claim_document_for_ingestion(uuid) from public, anon;
grant execute on function public.claim_document_for_ingestion(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- hybrid_search_chunks
--
-- Semantic (pgvector cosine) and lexical (Postgres FTS) retrieval, fused with
-- Reciprocal Rank Fusion.
--
-- Why RRF rather than blending the two scores: cosine similarity and
-- ts_rank_cd live on incomparable scales that drift with corpus size and query
-- length, so any fixed normalisation constant would be wrong a month later.
-- RRF consumes only RANKS, which makes it scale-free and essentially
-- tuning-free. k = 60 is the value from the original Cormack et al. paper.
--
-- SECURITY INVOKER, with auth.uid() read inside rather than taken as a
-- parameter: there is no owner_id argument a caller could spoof, and the RLS
-- policy on chunks is a second, independent barrier. Call it with the user's
-- cookie-scoped client -- never with the secret-key client.
--
-- Note the documents join and the status filter are applied AFTER the fuse,
-- not inside the semantic CTE. Putting a join inside the vector branch defeats
-- the HNSW index scan. At demo scale a seq scan would be sub-10ms either way,
-- but this structure stays correct as the corpus grows.
-- ---------------------------------------------------------------------------
create or replace function public.hybrid_search_chunks(
  p_query_text      text,
  p_query_embedding extensions.vector(1536),
  p_document_ids    uuid[] default null,   -- null/empty = entire corpus
  p_match_count     int    default 30,
  p_rrf_k           int    default 60,
  p_vec_weight      float  default 1.0,
  p_fts_weight      float  default 1.0,
  p_candidate_mult  int    default 4       -- over-fetch per arm before fusing
)
returns table (
  chunk_id          uuid,
  document_id       uuid,
  document_title    text,
  doc_kind          text,
  content           text,
  contextual_text   text,
  heading           text,
  content_kind      text,
  page_from         int,
  page_to           int,
  section_path      text[],
  vector_rank       int,
  fts_rank          int,
  vector_similarity float,
  fts_score         float,
  rrf_score         float
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_limit int  := least(greatest(p_match_count, 1), 50);
  v_fetch int;
  v_scope uuid[] := nullif(p_document_ids, '{}');
  v_tsq   tsquery := websearch_to_tsquery('english', coalesce(p_query_text, ''));
begin
  if v_owner is null then
    raise exception 'hybrid_search_chunks: no authenticated user'
      using errcode = '42501';
  end if;

  v_fetch := v_limit * greatest(p_candidate_mult, 1);

  -- Keep pulling HNSW candidates until the filters are satisfied, rather than
  -- post-filtering a fixed ef_search window down to almost nothing. Without
  -- this, an owner-scoped vector search on a shared table can return far fewer
  -- rows than the LIMIT asked for.
  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);

  return query
  with semantic as (
    select c.id,
           row_number() over (order by c.embedding operator(extensions.<=>) p_query_embedding)::int as rank_ix,
           (1 - (c.embedding operator(extensions.<=>) p_query_embedding))::float as sim
      from public.chunks c
     where c.owner_id = v_owner
       and c.embedding is not null
       and (v_scope is null or c.document_id = any(v_scope))
     order by c.embedding operator(extensions.<=>) p_query_embedding
     limit v_fetch
  ),
  lexical as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.fts, v_tsq) desc)::int as rank_ix,
           ts_rank_cd(c.fts, v_tsq)::float as score
      from public.chunks c
     where c.owner_id = v_owner
       and (v_scope is null or c.document_id = any(v_scope))
       and c.fts @@ v_tsq
     order by rank_ix
     limit v_fetch
  ),
  fused as (
    select coalesce(s.id, l.id) as id,
           s.rank_ix as vec_rank,
           l.rank_ix as fts_rank,
           coalesce(s.sim, 0)::float   as vec_score,
           coalesce(l.score, 0)::float as lex_score,
           ( coalesce(p_vec_weight / (p_rrf_k + s.rank_ix), 0.0)
           + coalesce(p_fts_weight / (p_rrf_k + l.rank_ix), 0.0) )::float as rrf
      from semantic s
      full outer join lexical l on s.id = l.id
  )
  select c.id,
         c.document_id,
         d.title,
         d.doc_kind::text,
         c.content,
         c.contextual_text,
         c.heading,
         c.content_kind,
         c.page_from,
         c.page_to,
         c.section_path,
         f.vec_rank,
         f.fts_rank,
         f.vec_score,
         f.lex_score,
         f.rrf
    from fused f
    join public.chunks    c on c.id = f.id
    join public.documents d on d.id = c.document_id
   where d.status = 'ready'
   order by f.rrf desc
   limit v_limit;
end
$$;

revoke all on function public.hybrid_search_chunks(text, extensions.vector, uuid[], int, int, float, float, int)
  from public, anon;
grant execute on function public.hybrid_search_chunks(text, extensions.vector, uuid[], int, int, float, float, int)
  to authenticated, service_role;

commit;
