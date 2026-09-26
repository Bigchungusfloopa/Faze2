import type { SupabaseClient } from "@supabase/supabase-js";
import { cachedEmbedQuery } from "./cache";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  docKind: string | null;
  content: string;
  contextualText: string | null;
  heading: string | null;
  contentKind: string;
  pageFrom: number | null;
  pageTo: number | null;
  sectionPath: string[];
  vectorRank: number | null;
  ftsRank: number | null;
  vectorSimilarity: number;
  ftsScore: number;
  rrfScore: number; // for a single sub-query call; summed across sub-queries after fuseAcrossSubQueries
}

interface RpcRow {
  chunk_id: string;
  document_id: string;
  document_title: string;
  doc_kind: string | null;
  content: string;
  contextual_text: string | null;
  heading: string | null;
  content_kind: string;
  page_from: number | null;
  page_to: number | null;
  section_path: string[] | null;
  vector_rank: number | null;
  fts_rank: number | null;
  vector_similarity: number;
  fts_score: number;
  rrf_score: number;
}

function mapRow(r: RpcRow): RetrievedChunk {
  return {
    chunkId: r.chunk_id,
    documentId: r.document_id,
    documentTitle: r.document_title,
    docKind: r.doc_kind,
    content: r.content,
    contextualText: r.contextual_text,
    heading: r.heading,
    contentKind: r.content_kind,
    pageFrom: r.page_from,
    pageTo: r.page_to,
    sectionPath: r.section_path ?? [],
    vectorRank: r.vector_rank,
    ftsRank: r.fts_rank,
    vectorSimilarity: r.vector_similarity,
    ftsScore: r.fts_score,
    rrfScore: r.rrf_score,
  };
}

/**
 * One sub-query's hybrid search. Must be called with the user's cookie-scoped
 * client -- hybrid_search_chunks is SECURITY INVOKER and reads auth.uid()
 * internally, so the admin client would fail its own auth check.
 */
export async function retrieveForQuery(
  supabase: SupabaseClient,
  query: string,
  documentIds: string[] | null,
  matchCount = 40
): Promise<RetrievedChunk[]> {
  const embedding = await cachedEmbedQuery(query);

  const { data, error } = await supabase.rpc("hybrid_search_chunks", {
    p_query_text: query,
    p_query_embedding: embedding,
    p_document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
    p_match_count: matchCount,
  });

  if (error) throw new Error(`hybrid_search_chunks failed: ${error.message}`);
  return ((data ?? []) as RpcRow[]).map(mapRow);
}

const PER_DOCUMENT_CAP = 6;
const PER_SUBQUERY_FLOOR = 3;

/**
 * Runs retrieval for every sub-query in parallel, fuses the results by
 * summing RRF scores across sub-queries (a chunk that multiple sub-queries
 * agree on ranks higher than one only one sub-query liked), then applies a
 * diversity guard.
 *
 * The guard exists because RRF fusion alone can return 40 chunks all from one
 * document, which defeats "combine information across multiple sources"
 * outright -- a single dominant document can crowd out everything else. The
 * cap limits any one document to PER_DOCUMENT_CAP chunks in the result; the
 * floor guarantees each sub-query contributes at least PER_SUBQUERY_FLOOR
 * chunks even if its candidates individually rank below another sub-query's,
 * so a "compare X and Y" question can't collapse onto whichever side of the
 * comparison the embedding space favours. Both run BEFORE reranking, so the
 * reranker sees a genuinely diverse slate rather than filtering after the
 * diversity has already been discarded.
 */
export async function retrieveMulti(
  supabase: SupabaseClient,
  subQueries: string[],
  documentIds: string[] | null,
  matchCount = 40
): Promise<RetrievedChunk[]> {
  const perQueryResults = await Promise.all(
    subQueries.map((q) => retrieveForQuery(supabase, q, documentIds, matchCount))
  );

  // Fuse: sum RRF scores for a chunk that appears under multiple sub-queries.
  const fused = new Map<string, RetrievedChunk>();
  for (const results of perQueryResults) {
    for (const chunk of results) {
      const existing = fused.get(chunk.chunkId);
      if (existing) {
        existing.rrfScore += chunk.rrfScore;
      } else {
        fused.set(chunk.chunkId, { ...chunk });
      }
    }
  }
  const merged = Array.from(fused.values()).sort((a, b) => b.rrfScore - a.rrfScore);

  if (subQueries.length <= 1) {
    return applyDiversityCap(merged);
  }

  // Guarantee each sub-query's own top candidates survive the cap, then fill
  // the rest with whatever the merged, capped ranking prefers.
  const guaranteed = new Set<string>();
  const floorPicks: RetrievedChunk[] = [];
  for (const results of perQueryResults) {
    for (const chunk of results.slice(0, PER_SUBQUERY_FLOOR)) {
      if (!guaranteed.has(chunk.chunkId)) {
        guaranteed.add(chunk.chunkId);
        const fusedChunk = fused.get(chunk.chunkId);
        if (fusedChunk) floorPicks.push(fusedChunk);
      }
    }
  }

  const rest = merged.filter((c) => !guaranteed.has(c.chunkId));
  return applyDiversityCap([...floorPicks, ...rest]);
}

function applyDiversityCap(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const perDocCount = new Map<string, number>();
  const out: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    const count = perDocCount.get(chunk.documentId) ?? 0;
    if (count >= PER_DOCUMENT_CAP) continue;
    perDocCount.set(chunk.documentId, count + 1);
    out.push(chunk);
  }
  return out;
}
