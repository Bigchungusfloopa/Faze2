import { Type, type Schema } from "@google/genai";
import { generateJson } from "@/lib/gemini/json";
import { GEMINI_FAST_MODEL } from "@/lib/gemini/models";
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

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["scores"],
  properties: {
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["index", "score", "why"],
        properties: {
          index: { type: Type.INTEGER },
          score: {
            type: Type.INTEGER,
            minimum: 0,
            maximum: 3,
            description: "3 = directly answers the query. 2 = contains a necessary supporting fact. 1 = same topic, no answer. 0 = irrelevant.",
          },
          why: { type: Type.STRING, description: "One short phrase." },
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

Score every candidate, using its index exactly as given.

${listing}`;

  let raw: { scores: RawScore[] };
  try {
    raw = await generateJson<{ scores: RawScore[] }>(GEMINI_FAST_MODEL, prompt, RESPONSE_SCHEMA);
  } catch {
    // Reranking failed -- fail toward abstention, not toward fabricating an
    // answer from unranked candidates. The caller treats this exactly like
    // "found nothing strong enough."
    return { sufficient: false, evidence: [], nearMisses: [] };
  }

  const scored: RerankedChunk[] = raw.scores
    .filter((s) => s.index >= 0 && s.index < pool.length)
    .map((s) => ({ ...pool[s.index], rerankScore: s.score, rerankWhy: s.why }))
    .sort((a, b) => b.rerankScore - a.rerankScore);

  const evidence = scored.filter((c) => c.rerankScore >= STRONG_THRESHOLD).slice(0, MAX_EVIDENCE);

  return {
    sufficient: evidence.length > 0,
    evidence,
    nearMisses: scored.slice(0, 3),
  };
}
