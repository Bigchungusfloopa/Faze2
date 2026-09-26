import { EMBED_DIM, EMBED_MODEL } from "./models";

const API = "https://api.mistral.ai/v1";
const MAX_ATTEMPTS = 5;

/** A JSON Schema object for Mistral's strict structured-output mode. */
export type JsonSchema = Record<string, unknown>;

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: string };
export type Message = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export function hasMistralKey(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

class MistralError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * POST with retry on 429 and 5xx. Honors Retry-After when present, otherwise
 * exponential backoff with jitter. Other 4xx errors fail immediately: a bad
 * request won't get better by repeating it.
 */
async function post(path: string, body: unknown): Promise<Response> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY is not set.");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    const detail = await res.text().catch(() => "");
    if (!retryable || attempt >= MAX_ATTEMPTS - 1) {
      throw new MistralError(`Mistral ${path} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt + Math.random() * 500;
    await new Promise((r) => setTimeout(r, Math.min(delay, 20_000)));
  }
}

/**
 * One structured-output call. Strict json_schema mode, plus one retry if the
 * body still fails to parse. Returns the model's snake_case keys as-is:
 * callers map them explicitly (`as T` is a type assertion, not a conversion).
 */
export async function chatJson<T>(
  model: string,
  input: string | Message[],
  schema: JsonSchema,
  { temperature = 0.1, maxTokens }: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const messages: Message[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await post("/chat/completions", {
      model,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      messages,
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
    });
    const data = await res.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) continue;
    try {
      return JSON.parse(text) as T;
    } catch {
      // fall through to retry
    }
  }
  throw new Error(`chatJson: ${model} did not return parseable JSON after 2 attempts`);
}

/** Plain (non-JSON) completion, used for vision transcription. */
export async function chatText(model: string, messages: Message[], { temperature = 0, maxTokens }: { temperature?: number; maxTokens?: number } = {}) {
  const res = await post("/chat/completions", { model, temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}), messages });
  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string | undefined) ?? "";
}

/**
 * Streams text deltas. Retries happen only before the first byte (inside
 * post()); once tokens are flowing, a mid-stream failure surfaces as an error
 * rather than silently restarting and duplicating output.
 */
export async function* chatStream(model: string, messages: Message[], { temperature = 0.1 } = {}): AsyncGenerator<string> {
  const res = await post("/chat/completions", { model, temperature, stream: true, messages });
  if (!res.body) throw new Error("Mistral stream returned no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) yield delta;
    }
  }
}

// mistral-embed caps input tokens per request; batch conservatively by size.
const EMBED_BATCH_CHARS = 40_000;
const EMBED_BATCH_ITEMS = 64;

/** Embeds texts in order, batched. Mistral's embeddings are symmetric: no query/document task type. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  let batch: string[] = [];
  let size = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const res = await post("/embeddings", { model: EMBED_MODEL, input: batch });
    const data = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    const ordered = data.data.slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (ordered.length !== batch.length || ordered.some((v) => v.length !== EMBED_DIM)) {
      throw new Error(`Embedding response mismatch: got ${ordered.length}x${ordered[0]?.length}, expected ${batch.length}x${EMBED_DIM}`);
    }
    out.push(...ordered);
    batch = [];
    size = 0;
  };

  for (const text of texts) {
    if (batch.length > 0 && (size + text.length > EMBED_BATCH_CHARS || batch.length >= EMBED_BATCH_ITEMS)) await flush();
    batch.push(text);
    size += text.length;
  }
  await flush();
  return out;
}
