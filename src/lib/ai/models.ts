// Mistral model IDs. Defaults are the models this project's API key can call
// (small/medium/large and the OCR models report a 0 req/min quota on it);
// override any of them with env vars after a plan upgrade.

export const ANSWER_MODEL = process.env.MISTRAL_ANSWER_MODEL || "ministral-14b-latest";
// Reranking decides whether the system answers at all (the evidence gate), so
// it gets the strongest available model rather than the fast one.
export const RERANK_MODEL = process.env.MISTRAL_RERANK_MODEL || "ministral-14b-latest";
export const FAST_MODEL = process.env.MISTRAL_FAST_MODEL || "ministral-8b-latest";
export const VISION_MODEL = process.env.MISTRAL_VISION_MODEL || "ministral-14b-latest";
export const EMBED_MODEL = process.env.MISTRAL_EMBED_MODEL || "mistral-embed";
// mistral-embed has a fixed output size; chunks.embedding is vector(1024) to match.
export const EMBED_DIM = 1024;
