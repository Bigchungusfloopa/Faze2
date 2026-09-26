import type { Content, ContentListUnion, Schema } from "@google/genai";
import { getGenAI } from "./client";

/**
 * One structured-output call: JSON mode plus a response schema, with one
 * retry on malformed JSON (the model occasionally truncates or adds prose
 * around the JSON despite the mode). Throws on a second failure rather than
 * silently returning something partial -- callers decide how to degrade.
 */
export async function generateJson<T>(
  model: string,
  contents: ContentListUnion | Content[],
  schema: Schema,
  { temperature = 0.1 }: { temperature?: number } = {}
): Promise<T> {
  const ai = getGenAI();

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.models.generateContent({
      model,
      contents,
      config: {
        temperature,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = res.text;
    if (!text) continue;
    try {
      return JSON.parse(text) as T;
    } catch {
      // fall through to retry
    }
  }

  throw new Error(`generateJson: model did not return parseable JSON after 2 attempts (${model})`);
}
