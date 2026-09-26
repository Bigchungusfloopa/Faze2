-- 0006_hybrid_search_workspace_scope.sql
--
-- Adds p_workspace_id to hybrid_search_chunks. A new named, defaulted
-- parameter -- PostgREST calls RPCs by parameter name, not position, so this
-- is additive and every existing caller that doesn't know about it keeps
-- working unchanged.
--
-- p_workspace_id null  -> personal corpus only: owner_id = caller AND
--                          workspace_id is null. A workspace document can
--                          NEVER be answered from in personal-scope chat.
-- p_workspace_id set   -> that workspace's shared corpus only, scoped by
--                          workspace_id alone (any member's uploads,
--                          regardless of who uploaded them). RLS on chunks
--                          (security invoker) is a second, independent
--                          guard: even a bug in this predicate could not
--                          surface a workspace's rows to a non-member,
--                          because the underlying SELECT would still be
--                          filtered by chunks_select.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0006_hybrid_search_workspace_scope.sql

begin;

-- CREATE OR REPLACE does NOT replace a function whose parameter list has
-- changed shape -- Postgres identifies functions by (name, parameter TYPES),
-- so adding p_workspace_id here creates a SECOND overload rather than
-- replacing the original. Left alone, a call that omits p_workspace_id
-- becomes ambiguous between the two overloads, and PostgREST resolves it to
-- the OLD one -- which has no workspace filtering at all -- silently
-- leaking every workspace's chunks into "personal-scope" search. Verified
-- directly: this happened on the first live test of this migration, for
-- both a workspace member and the workspace owner's own personal-scope
-- query. The old overload must be dropped explicitly.
drop function if exists public.hybrid_search_chunks(text, extensions.vector, uuid[], int, int, float, float, int);

create or replace function public.hybrid_search_chunks(
  p_query_text      text,
  p_query_embedding extensions.vector(1536),
  p_document_ids    uuid[] default null,
  p_match_count     int    default 30,
  p_rrf_k           int    default 60,
  p_vec_weight      float  default 1.0,
  p_fts_weight      float  default 1.0,
  p_candidate_mult  int    default 4,
  p_workspace_id    uuid   default null
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

  perform set_config('hnsw.ef_search', '100', true);
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);

  return query
  with semantic as (
    select c.id,
           row_number() over (order by c.embedding operator(extensions.<=>) p_query_embedding)::int as rank_ix,
           (1 - (c.embedding operator(extensions.<=>) p_query_embedding))::float as sim
      from public.chunks c
     where c.embedding is not null
       and (
             (p_workspace_id is null and c.owner_id = v_owner and c.workspace_id is null)
          or (p_workspace_id is not null and c.workspace_id = p_workspace_id)
       )
       and (v_scope is null or c.document_id = any(v_scope))
     order by c.embedding operator(extensions.<=>) p_query_embedding
     limit v_fetch
  ),
  lexical as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.fts, v_tsq) desc)::int as rank_ix,
           ts_rank_cd(c.fts, v_tsq)::float as score
      from public.chunks c
     where (
             (p_workspace_id is null and c.owner_id = v_owner and c.workspace_id is null)
          or (p_workspace_id is not null and c.workspace_id = p_workspace_id)
       )
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
  select c.id, c.document_id,
         d.title, d.doc_kind::text,
         c.content, c.contextual_text, c.heading, c.content_kind,
         c.page_from, c.page_to, c.section_path,
         f.vec_rank, f.fts_rank, f.vec_score, f.lex_score, f.rrf
    from fused f
    join public.chunks    c on c.id = f.id
    join public.documents d on d.id = c.document_id
   where d.status = 'ready'
   order by f.rrf desc
   limit v_limit;
end
$$;

revoke all on function public.hybrid_search_chunks(text, extensions.vector, uuid[], int, int, float, float, int, uuid)
  from public, anon;
grant execute on function public.hybrid_search_chunks(text, extensions.vector, uuid[], int, int, float, float, int, uuid)
  to authenticated, service_role;

commit;
