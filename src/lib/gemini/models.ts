// Model IDs live in env vars, not hardcoded here.
//
// Google's own Embeddings guide and Models page currently disagree on the
// exact embedding model ID (gemini-embedding-2 vs gemini-embedding-2-preview),
// and generation model IDs move fast enough that a hardcoded default would go
// stale. Resolve the real values with one `ai.models.list()` call when the
// key first lands, then set them here.

export const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";
export const GEMINI_EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 1536);
export const GEMINI_PARSE_MODEL = process.env.GEMINI_PARSE_MODEL || "gemini-3.8-flash";
export const GEMINI_FAST_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
export const GEMINI_ANSWER_MODEL = process.env.GEMINI_ANSWER_MODEL || "gemini-3.8-flash";
