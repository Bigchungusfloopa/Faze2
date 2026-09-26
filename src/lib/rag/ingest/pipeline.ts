import { createAdminClient } from "@/lib/supabase/admin";
import type { DocStage } from "@/types/rag";

/**
 * The single entry point for ingesting one document.
 *
 * Signature is deliberately (documentId: string) => Promise<void> -- no
 * request, no cookies, nothing tied to the HTTP call that triggered it. That
 * is the liftability contract: moving this from an in-process `after()` call
 * into a real background worker later is a matter of importing this same
 * function from a different caller, not rewriting it.
 *
 * PHASE 2 STUB: without GEMINI_API_KEY set, this walks the document through
 * every real stage with placeholder timing and writes zero chunks, so the
 * status machine, the ingestion_events audit trail, and the UI's pipeline
 * stepper are provably correct before a single Gemini token is spent. Phase 3
 * replaces the body of the `if (!apiKey)` branch's else-arm with the real
 * classify -> extract -> contextualize -> chunk -> embed sequence; the claim,
 * the failure handling, and this function's signature do not change.
 */
export async function runIngestion(documentId: string): Promise<void> {
  const db = createAdminClient();

  // Atomic claim -- see claim_document_for_ingestion() in
  // 0003_rag_functions.sql. A false return means another worker already holds
  // this document, or it is not in a claimable state (already ready, or
  // failed with no retries left). Either way, exit quietly.
  const { data: claimed, error: claimError } = await db.rpc("claim_document_for_ingestion", {
    p_document_id: documentId,
  });
  if (claimError) {
    console.error(`[ingest ${documentId}] claim RPC failed:`, claimError.message);
    return;
  }
  if (!claimed) return;

  const { data: doc } = await db
    .from("documents")
    .select("owner_id")
    .eq("id", documentId)
    .single();
  if (!doc) {
    console.error(`[ingest ${documentId}] claimed but row is gone`);
    return;
  }
  const ownerId = doc.owner_id as string;

  try {
    if (!process.env.GEMINI_API_KEY) {
      await runStub(db, documentId, ownerId);
      return;
    }

    // TODO(Phase 3): real pipeline.
    //   classify(documentId)        -> doc_kind, pipeline, classification_*
    //   extract(documentId)         -> documents.pages, page_count
    //   contextualize(documentId)   -> documents.doc_summary, outline
    //   chunk(documentId)           -> chunks rows (content, section_path, ...)
    //   embed(documentId)           -> chunks.embedding
    // Each stage writes documents.stage/progress_pct and an ingestion_events
    // row as it goes, the same way runStub() does below.
    await runStub(db, documentId, ownerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest ${documentId}] failed:`, message);
    await db
      .from("documents")
      .update({ status: "failed", stage: "failed", error: message.slice(0, 500) })
      .eq("id", documentId);
    await logEvent(db, documentId, ownerId, "failed", "error", message.slice(0, 500));
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

const STUB_STAGES: Array<{ stage: DocStage; pct: number; ms: number }> = [
  { stage: "classifying", pct: 15, ms: 500 },
  { stage: "extracting", pct: 45, ms: 900 },
  { stage: "contextualizing", pct: 65, ms: 500 },
  { stage: "chunking", pct: 80, ms: 400 },
  { stage: "embedding", pct: 95, ms: 500 },
];

const STUB_DETAIL = "Stub run — set GEMINI_API_KEY to ingest real content.";

async function runStub(db: AdminClient, documentId: string, ownerId: string) {
  for (const step of STUB_STAGES) {
    await sleep(step.ms);
    await db
      .from("documents")
      .update({ stage: step.stage, progress_pct: step.pct, stage_detail: STUB_DETAIL })
      .eq("id", documentId);
    await logEvent(db, documentId, ownerId, step.stage, "ok", STUB_DETAIL, step.ms);
  }

  await db
    .from("documents")
    .update({
      status: "ready",
      stage: "done",
      progress_pct: 100,
      stage_detail: STUB_DETAIL,
      chunk_count: 0,
      ingest_finished_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  await logEvent(db, documentId, ownerId, "done", "ok", STUB_DETAIL);
}

async function logEvent(
  db: AdminClient,
  documentId: string,
  ownerId: string,
  stage: DocStage,
  status: "started" | "ok" | "error",
  detail?: string,
  ms?: number
) {
  await db.from("ingestion_events").insert({
    document_id: documentId,
    owner_id: ownerId,
    stage,
    status,
    detail: detail ?? null,
    ms: ms ?? null,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
