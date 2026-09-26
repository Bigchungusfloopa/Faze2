-- 0002_rag_module.sql
--
-- The document-intelligence module: corpus, chunks, chat, and the ingestion
-- audit trail.
--
-- These tables are deliberately SEPARATE from vault_items. The only link back
-- to the existing world is documents.file_id, which is nullable: a vault file
-- can be promoted into the corpus, and a corpus document need not be a vault
-- file. Nothing in the existing vault code path changes.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rag_module.sql

begin;

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.doc_status as enum ('queued', 'processing', 'ready', 'failed');

-- Fine-grained stage, surfaced in the UI as the pipeline stepper.
create type public.doc_stage as enum (
  'uploaded', 'classifying', 'extracting', 'contextualizing',
  'chunking', 'embedding', 'done', 'failed'
);

-- WHAT the document is. Drives prompt selection and chunking policy.
create type public.doc_kind as enum (
  'lecture_slides', 'textbook_chapter', 'research_paper', 'handwritten_notes',
  'scanned_worksheet', 'exam_paper', 'table_dataset', 'diagram_image',
  'plain_text', 'generic_text', 'unknown'
);

-- HOW the document must be read. Orthogonal to doc_kind, and that separation
-- is the key modelling decision here: a research_paper can be born-digital OR
-- a bad scan. The pipeline differs completely; the chunking policy does not.
create type public.doc_pipeline as enum (
  'native_text',   -- extractable text layer, no vision parse
  'vision_ocr',    -- page images to the vision model (scans, handwriting, tables)
  'image_single',  -- a single image file
  'plain_text'     -- txt/md/csv, no parse at all
);

create type public.message_role as enum ('user', 'assistant');

-- The answer's own verdict on its evidence. Persisted so an abstention is a
-- first-class, inspectable outcome rather than an absence.
create type public.answer_verdict as enum (
  'answered', 'partial', 'insufficient_evidence', 'conflicting_evidence', 'no_retrieval'
);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,

  -- The seam to the existing vault. Nullable by design.
  -- ON DELETE SET NULL, not CASCADE: deleting a vault item must orphan the
  -- backlink, never destroy an indexed corpus document.
  file_id         uuid references public.files (id) on delete set null,
  source          text not null default 'direct' check (source in ('direct', 'vault')),

  title           text not null,
  source_filename text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  storage_key     text not null,
  checksum_sha256 text not null,

  -- Pipeline state
  status          public.doc_status not null default 'queued',
  stage           public.doc_stage  not null default 'uploaded',
  progress_pct    smallint not null default 0 check (progress_pct between 0 and 100),
  stage_detail    text,
  error           text,
  attempts        smallint not null default 0,

  -- Classification, written by the worker
  doc_kind                  public.doc_kind,
  pipeline                  public.doc_pipeline,
  classification_confidence real check (classification_confidence between 0 and 1),
  classification_reason     text,

  -- Extracted structure and metadata
  page_count   int check (page_count >= 0),
  language     text,
  doc_summary  text,                                   -- feeds the contextual prefix
  outline      jsonb not null default '[]'::jsonb,     -- [{path[], summary, keywords[]}]
  metadata     jsonb not null default '{}'::jsonb,     -- authors, course, date, ...
  -- Per-page markdown: [{page_no, text_md, has_tables, is_noisy, ocr_confidence}]
  -- Kept as jsonb rather than its own table; page-level citation works because
  -- page_from/page_to live on chunks.
  pages        jsonb not null default '[]'::jsonb,
  chunk_count  int not null default 0,

  ingest_started_at  timestamptz,
  ingest_finished_at timestamptz,
  ingest_ms          int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Dedupe is enforced HERE, in the database, not in a cache.
  unique (owner_id, checksum_sha256)
);

-- ---------------------------------------------------------------------------
-- chunks -- the retrieval unit
-- ---------------------------------------------------------------------------
create table public.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  -- Denormalised deliberately: it makes every RLS policy a flat indexed
  -- equality instead of an EXISTS subquery against documents, and a subquery
  -- policy here would be evaluated per row inside the vector scan.
  owner_id    uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,

  -- VERBATIM source text. This is what a citation snippet quotes, and it is
  -- the ONLY text ever shown to the answering model as evidence.
  content         text not null,
  -- LLM-generated text situating the chunk in its document. An embedding and
  -- search aid ONLY -- never rendered as evidence, or the system ends up
  -- citing its own summary as a source.
  contextual_text text,

  content_kind text not null default 'prose'
    check (content_kind in ('prose', 'table', 'code', 'figure_caption', 'formula', 'list', 'slide')),

  -- Provenance, for citations
  page_from    int,
  page_to      int,
  section_path text[] not null default '{}',
  heading      text,
  token_count  int,

  embedding       extensions.vector(1536),
  embedding_model text,

  -- Lexical half of hybrid search. Includes the contextual text and heading,
  -- so an acronym expanded only in the preamble is still findable.
  fts tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(heading, '') || ' ' ||
      coalesce(contextual_text, '') || ' ' ||
      content
    )
  ) stored,

  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  title              text not null default 'New chat',
  scope_document_ids uuid[],          -- null or empty = entire corpus
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  role            public.message_role not null,
  content         text not null default '',

  -- Retrieval trace: everything needed to explain or replay an answer.
  rewritten_query text,
  sub_queries     text[],
  verdict         public.answer_verdict,
  retrieval       jsonb not null default '{}'::jsonb,
  grounding       jsonb not null default '{}'::jsonb,
  cache_hit       boolean,
  retrieval_ms    int,
  rerank_ms       int,
  generate_ms     int,
  model           text,
  token_usage     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table public.message_citations (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  -- ON DELETE SET NULL so a re-ingest or document delete does not erase the
  -- record of what an earlier answer was based on.
  chunk_id    uuid references public.chunks (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  owner_id    uuid not null references auth.users (id) on delete cascade,

  marker       int  not null,   -- the [1], [2] the user sees
  rank         int,
  vector_rank  int,
  fts_rank     int,
  rrf_score    double precision,
  rerank_score real,

  -- Frozen at answer time. Survives the document being deleted or re-ingested,
  -- so the evidence panel of an old answer keeps working.
  snippet        text not null,
  document_title text,
  page_from      int,
  page_to        int,
  section_path   text[] not null default '{}',
  used_in_answer boolean not null default false,

  created_at timestamptz not null default now(),
  unique (message_id, marker)
);

-- ---------------------------------------------------------------------------
-- ingestion_events -- append-only audit trail, powers the pipeline stepper
-- ---------------------------------------------------------------------------
create table public.ingestion_events (
  id          bigserial primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  stage       public.doc_stage not null,
  status      text not null check (status in ('started', 'ok', 'error')),
  detail      text,
  ms          int,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Vector half of hybrid search.
--
-- HNSW over IVFFlat, deliberately: IVFFlat must be TRAINED on existing rows to
-- pick its centroids, and this table starts empty and grows during the demo --
-- exactly the shape where IVFFlat recall collapses. HNSW builds incrementally
-- and needs no training. Its costs (slower inserts, more memory) are paid in a
-- background job on a corpus of thousands, not billions, of rows.
create index chunks_embedding_hnsw on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index chunks_fts_gin      on public.chunks using gin (fts);
create index chunks_owner_idx    on public.chunks (owner_id);
create index chunks_doc_idx      on public.chunks (document_id, chunk_index);
-- Serves the embedding-resume query: a retry only re-embeds what is missing.
create index chunks_pending_embed_idx on public.chunks (document_id)
  where embedding is null;

create index documents_owner_status_idx on public.documents (owner_id, status, created_at desc);
create index documents_file_idx         on public.documents (file_id) where file_id is not null;
create index documents_active_idx       on public.documents (status)
  where status in ('queued', 'processing');

create index messages_conv_idx        on public.messages (conversation_id, created_at);
create index conversations_owner_idx  on public.conversations (owner_id, updated_at desc);
create index citations_message_idx    on public.message_citations (message_id, marker);
create index ingestion_events_doc_idx on public.ingestion_events (document_id, id);

-- ---------------------------------------------------------------------------
-- Keep denormalised owner_id honest, and updated_at fresh.
-- ---------------------------------------------------------------------------
create or replace function public.tg_inherit_document_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    select d.owner_id into new.owner_id
      from public.documents d where d.id = new.document_id;
    if new.owner_id is null then
      raise exception 'unknown document %', new.document_id;
    end if;
  end if;
  return new;
end
$$;

create trigger chunks_inherit_owner before insert on public.chunks
  for each row execute function public.tg_inherit_document_owner();

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger documents_touch before update on public.documents
  for each row execute function public.tg_touch_updated_at();

create trigger conversations_touch before update on public.conversations
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security -- owner-only across the board.
-- ---------------------------------------------------------------------------
alter table public.documents         enable row level security;
alter table public.chunks            enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.message_citations enable row level security;
alter table public.ingestion_events  enable row level security;

create policy documents_owner_rw on public.documents
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy chunks_owner_rw on public.chunks
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy conversations_owner_rw on public.conversations
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy messages_owner_rw on public.messages
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy citations_owner_rw on public.message_citations
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Read-only to the user; only the ingestion worker (secret key, bypasses RLS)
-- ever writes these.
create policy ingestion_events_owner_read on public.ingestion_events
  for select to authenticated
  using (owner_id = (select auth.uid()));

commit;
