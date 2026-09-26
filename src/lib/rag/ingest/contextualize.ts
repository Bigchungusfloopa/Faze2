import { Type, type Schema } from "@google/genai";
import { generateJson } from "@/lib/gemini/json";
import { GEMINI_FAST_MODEL } from "@/lib/gemini/models";
import type { ChunkDraft, ExtractedPage } from "./chunk";

/**
 * The cheap variant of Anthropic-style contextual retrieval: ONE call per
 * document, not one per chunk. A per-chunk call is the textbook approach and
 * captures slightly more nuance, but on a 200-chunk document it would be the
 * single largest cost in the whole pipeline. This captures most of the same
 * benefit -- disambiguating a chunk's pronouns, acronyms and place in the
 * document -- by summarising once and assembling the per-chunk header in
 * plain code afterward.
 */

export interface DocContext {
  docSummary: string;
  sections: Array<{ path: string[]; summary: string }>;
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["doc_summary", "sections"],
  properties: {
    doc_summary: { type: Type.STRING, description: "60 words or fewer summarising the whole document." },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["path", "summary"],
        properties: {
          path: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The heading path, e.g. ['Chapter 3', '3.2 Chain rule'].",
          },
          summary: { type: Type.STRING, description: "30 words or fewer summarising this section." },
        },
      },
    },
  },
};

const MAX_INPUT_CHARS = 60_000;

// generateJson<T>() is `JSON.parse(text) as T` -- a type assertion, not a
// runtime conversion. The model returns the snake_case keys the schema asks
// for; casting straight to DocContext's camelCase shape would compile fine
// and be silently wrong at runtime (found by testing: docSummary came back
// "undefined" because the real key was doc_summary). Map explicitly.
interface RawDocContext {
  doc_summary: string;
  sections: Array<{ path: string[]; summary: string }>;
}

export async function contextualizeDocument(
  pages: ExtractedPage[],
  title: string,
  docKind: string | null
): Promise<DocContext> {
  const fullText = pages.map((p) => p.markdown).join("\n\n");
  const truncated = fullText.length > MAX_INPUT_CHARS ? fullText.slice(0, MAX_INPUT_CHARS) + "\n\n[...truncated]" : fullText;

  const prompt = `Document title: "${title}"${docKind ? ` (${docKind})` : ""}

${truncated}

Summarise this document (<=60 words), and separately summarise (<=30 words
each) every section you can identify from its heading hierarchy. If the
document has no headings, return an empty sections array.`;

  const raw = await generateJson<RawDocContext>(GEMINI_FAST_MODEL, prompt, RESPONSE_SCHEMA);
  return { docSummary: raw.doc_summary, sections: raw.sections ?? [] };
}

/** For short documents that would never clear Gemini's implicit-caching threshold anyway. */
export function templatedContext(title: string, docKind: string | null): DocContext {
  return { docSummary: `${title}${docKind ? ` (${docKind})` : ""}.`, sections: [] };
}

/**
 * Builds the per-chunk contextual preamble in plain code, no further LLM
 * cost. Matches the chunk's section_path against the document's section
 * summaries by longest common prefix, so a chunk one level deeper than any
 * summarised section still gets its closest ancestor's summary rather than
 * nothing.
 */
export function assembleContextHeader(
  chunk: Pick<ChunkDraft, "sectionPath" | "pageFrom" | "pageTo">,
  ctx: DocContext,
  title: string,
  docKind: string | null
): string {
  let best: { path: string[]; summary: string } | null = null;
  let bestOverlap = -1;
  for (const section of ctx.sections) {
    let overlap = 0;
    while (
      overlap < section.path.length &&
      overlap < chunk.sectionPath.length &&
      section.path[overlap] === chunk.sectionPath[overlap]
    ) {
      overlap++;
    }
    if (overlap > 0 && overlap > bestOverlap) {
      best = section;
      bestOverlap = overlap;
    }
  }

  const pageRange = chunk.pageFrom === chunk.pageTo ? `page ${chunk.pageFrom}` : `pages ${chunk.pageFrom}-${chunk.pageTo}`;
  const sectionLabel = chunk.sectionPath.length > 0 ? chunk.sectionPath.join(" > ") : null;

  const parts = [`From "${title}"${docKind ? ` (${docKind})` : ""}.`];
  if (sectionLabel) parts.push(`Section: ${sectionLabel}.`);
  if (best) parts.push(best.summary);
  else if (ctx.docSummary) parts.push(ctx.docSummary);
  parts.push(`${pageRange.charAt(0).toUpperCase()}${pageRange.slice(1)}.`);

  return parts.join(" ");
}
