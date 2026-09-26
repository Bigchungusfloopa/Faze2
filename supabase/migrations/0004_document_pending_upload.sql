-- 0004_document_pending_upload.sql
--
-- The two-step upload flow (get a presigned PUT, then confirm once the bytes
-- have actually landed in the bucket) needs a status that means "the row
-- exists but nothing has been claimed for ingestion yet." doc_status only had
-- queued/processing/ready/failed -- setting 'queued' at the presign step
-- would make claim_document_for_ingestion() able to pick the document up
-- before the browser has even started the PUT.
--
-- This file does ONLY the ALTER TYPE. A value added by ALTER TYPE ... ADD
-- VALUE cannot be referenced by another statement in the SAME transaction on
-- older PostgreSQL, so it stays isolated in its own migration rather than
-- being folded into 0002.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_document_pending_upload.sql

begin;
alter type public.doc_status add value if not exists 'pending_upload' before 'queued';
commit;
