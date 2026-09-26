-- Switch embeddings from Gemini (1536 dims) to mistral-embed (1024 dims, fixed).
-- Vectors from different models aren't comparable, so existing chunks can't be
-- converted; they're cleared and their documents re-queued for ingestion.

begin;

drop index if exists public.chunks_embedding_hnsw;

delete from public.chunks;
update public.documents
   set status = 'queued', stage = 'uploaded', progress_pct = 0, chunk_count = 0, error = null
 where status in ('ready', 'failed');

alter table public.chunks alter column embedding type extensions.vector(1024);

create index chunks_embedding_hnsw on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);

commit;
