-- 0007_document_dedupe_scope.sql
--
-- documents' original dedupe constraint, unique(owner_id, checksum_sha256),
-- predates workspaces and dedupes globally per owner regardless of scope.
-- That is wrong now: if Alice uploads a PDF personally and later shares the
-- identical bytes into a workspace, the second insert is semantically a
-- different document (a different scope, in the "personal + shared both
-- exist" design) but would collide on the same unique key and fail.
--
-- Fixed with two partial unique indexes instead of one constraint:
--   - personal dedupe: unique per (owner, checksum) among documents with no
--     workspace, exactly the original behaviour for personal uploads.
--   - workspace dedupe: unique per (workspace, checksum) regardless of WHO
--     uploaded -- if any member already put that file in the workspace, a
--     second member uploading the same bytes should land on the existing
--     shared document, not create a duplicate copy of the same file in one
--     shared corpus.
-- A plain `unique (workspace_id, checksum_sha256)` constraint would not do
-- this correctly for the personal case: SQL unique constraints treat every
-- NULL as distinct from every other NULL, so two personal documents (both
-- workspace_id = null) would never collide and dedupe would silently stop
-- working. Partial indexes with an explicit `where` sidestep that.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0007_document_dedupe_scope.sql

begin;

alter table public.documents drop constraint if exists documents_owner_id_checksum_sha256_key;

create unique index documents_personal_dedupe_idx
  on public.documents (owner_id, checksum_sha256)
  where workspace_id is null;

create unique index documents_workspace_dedupe_idx
  on public.documents (workspace_id, checksum_sha256)
  where workspace_id is not null;

commit;
