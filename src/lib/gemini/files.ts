import { getGenAI } from "./client";

/**
 * Uploads bytes to the Gemini Files API and waits until they're ACTIVE
 * (usable in a generateContent call). Uploaded files are retained 48h and
 * cost nothing to store -- this is what lets the ingestion pipeline hand
 * Gemini the whole PDF once and reference it by URI across the
 * classify+extract call rather than re-uploading for every stage.
 */
export async function uploadAndWaitActive(
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
  { timeoutMs = 60_000, pollMs = 1500 }: { timeoutMs?: number; pollMs?: number } = {}
): Promise<{ uri: string; mimeType: string }> {
  const ai = getGenAI();

  // Buffer.from copies onto a plain ArrayBuffer -- Uint8Array's `buffer` can
  // be typed as ArrayBufferLike (which also covers SharedArrayBuffer), and
  // Blob's constructor wants ArrayBuffer specifically.
  const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
  const file = await ai.files.upload({ file: blob, config: { mimeType, displayName } });
  if (!file.name) throw new Error("Gemini file upload returned no name.");

  const deadline = Date.now() + timeoutMs;
  let current = file;
  while (current.state === "PROCESSING") {
    if (Date.now() > deadline) {
      throw new Error(`Gemini file ${file.name} did not become ACTIVE within ${timeoutMs}ms.`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
    current = await ai.files.get({ name: file.name });
  }

  if (current.state === "FAILED") {
    throw new Error(`Gemini file processing failed: ${current.error?.message || "unknown error"}`);
  }
  if (!current.uri) throw new Error("Gemini file has no uri after becoming ACTIVE.");

  return { uri: current.uri, mimeType: current.mimeType || mimeType };
}
