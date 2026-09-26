import { getGenAI } from "./client";
import { GEMINI_EMBED_MODEL, GEMINI_EMBED_DIM } from "./models";

// The SDK's own embedContent docstring shows `contents: [textA, textB, ...]`
// returning one embedding per string, as a batch. Verified against the live
// API: it does not -- an array of strings is treated as multiple PARTS of a
// single content, and the call returns exactly one embedding regardless of
// array length. There is no separate batchEmbedContents method in this SDK
// version either. So batching here means N concurrent single-text calls, not
// one call with N inputs.
const CONCURRENCY = 8;
const MAX_RETRIES = 4;

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Embeds one query. Always RETRIEVAL_QUERY -- mixing this up with
 * RETRIEVAL_DOCUMENT on the query side is the most common silent cause of a
 * RAG system that "returns nothing relevant."
 */
export async function embedQuery(text: string): Promise<number[]> {
  return embedOne(text, "RETRIEVAL_QUERY");
}

/**
 * Embeds document chunks for indexing. `title` is only used by the API when
 * taskType is RETRIEVAL_DOCUMENT, and only in that case is it useful.
 */
export async function embedDocuments(texts: string[], title?: string): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const i = cursor++;
      results[i] = await embedOne(texts[i], "RETRIEVAL_DOCUMENT", title);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
  return results;
}

async function embedOne(text: string, taskType: EmbedTaskType, title?: string, attempt = 0): Promise<number[]> {
  const ai = getGenAI();
  try {
    const res = await ai.models.embedContent({
      model: GEMINI_EMBED_MODEL,
      contents: text,
      config: {
        taskType,
        outputDimensionality: GEMINI_EMBED_DIM,
        ...(taskType === "RETRIEVAL_DOCUMENT" && title ? { title } : {}),
      },
    });

    const values = res.embeddings?.[0]?.values;
    if (!values || values.length !== GEMINI_EMBED_DIM) {
      throw new Error(`Embedding has ${values?.length ?? 0} dims, expected ${GEMINI_EMBED_DIM}`);
    }
    return values;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const isRateLimit = err instanceof Error && /429|rate|quota/i.test(err.message);
    const delay = isRateLimit ? 2 ** attempt * 1000 + Math.random() * 500 : 300 + Math.random() * 200;
    await new Promise((r) => setTimeout(r, delay));
    return embedOne(text, taskType, title, attempt + 1);
  }
}
