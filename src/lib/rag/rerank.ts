import { chatJson, type JsonSchema } from "@/lib/ai/mistral";
import { RERANK_MODEL } from "@/lib/ai/models";
import type { RetrievedChunk } from "./retrieve";

export interface RerankedChunk extends RetrievedChunk {
  rerankScore: number; // 0-3
  rerankWhy: string;
}

export interface RerankResult {
  sufficient: boolean;
  evidence: RerankedChunk[]; // score >= STRONG_THRESHOLD, what the generator actually sees
  nearMisses: RerankedChunk[]; // top few by score, shown to the user when insufficient
}

interface RawScore {
  index: number;
  score: number;
  why: string;
}

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "score", "why"],
        properties: {
          index: { type: "integer" },
          score: { type: "integer", enum: [0, 1, 2, 3] },
          why: { type: "string" },
        },
      },
    },
  },
};

const MAX_CANDIDATES = 50;
const SNIPPET_CHARS = 400;
// The abstention gate: a chunk must clear this to count as usable evidence.
// This is what stops the system calling the generator at all when nothing
// found actually answers the question -- a model cannot fabricate an answer
// it was never asked to write. This is enforced here in code, not left to a
// prompt instruction the model could ignore under pressure.
const STRONG_THRESHOLD = 2;
const MAX_EVIDENCE = 12;

export async function rerank(query: string, candidates: RetrievedChunk[]): Promise<RerankResult> {
  if (candidates.length === 0) return { sufficient: false, evidence: [], nearMisses: [] };

  const pool = candidates.slice(0, MAX_CANDIDATES);
  const listing = pool
    .map((c, i) => {
      const pages = c.pageFrom === c.pageTo ? `p.${c.pageFrom}` : `pp.${c.pageFrom}-${c.pageTo}`;
      const section = c.sectionPath.length > 0 ? ` > ${c.sectionPath.join(" > ")}` : "";
      return `[${i}] "${c.documentTitle}"${section} (${pages})\n${c.content.slice(0, SNIPPET_CHARS)}`;
    })
    .join("\n\n");

  const prompt = `Query: "${query}"

Score how useful each numbered candidate below is for answering the query.
Score 3 if it directly answers the query. Score 2 if it contains a fact the
answer would need but doesn't fully answer it alone. Score 1 if it's on the
same topic but doesn't help answer it. Score 0 if it's irrelevant.

Score every candidate, using its index exactly as given. "why" is one short phrase.

${listing}`;

  let raw: { scores: RawScore[] };
  try {
    raw = await chatJson<{ scores: RawScore[] }>(RERANK_MODEL, prompt, RESPONSE_SCHEMA);
  } catch {
    // Reranking failed -- fail toward abstention, not toward fabricating an
    // answer from unranked candidates. The caller treats this exactly like
    // "found nothing strong enough."
    return { sufficient: false, evidence: [], nearMisses: [] };
  }

  const scored: RerankedChunk[] = raw.scores
    .filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index < pool.length)
    // Keep the first score per candidate: a small model can repeat an index,
    // and a duplicate must not count as two pieces of evidence.
    .filter((s, i, all) => all.findIndex((o) => o.index === s.index) === i)
    .map((s) => ({ ...pool[s.index], rerankScore: s.score, rerankWhy: s.why }))
    .sort((a, b) => b.rerankScore - a.rerankScore);

  const evidence = scored.filter((c) => c.rerankScore >= STRONG_THRESHOLD).slice(0, MAX_EVIDENCE);

  return {
    sufficient: evidence.length > 0,
    evidence,
    nearMisses: scored.slice(0, 3),
  };
}
