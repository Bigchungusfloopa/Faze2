import { chatJson, type JsonSchema } from "@/lib/ai/mistral";
import { FAST_MODEL } from "@/lib/ai/models";
import type { DocKind, DocPipeline } from "@/types/rag";
import type { ExtractedPage } from "./chunk";

/**
 * Every format is first turned into per-page markdown by its own extractor
 * (PDF text layer, vision transcription for scans/images, Office XML, CSV),
 * then classified here from that text. `pipeline` records which extractor
 * ran; it's shown in the UI as proof of routing and, for slides, selects the
 * one-chunk-per-slide policy via docKind.
 */

type PageMeta = { pageNo: number; hasTables: boolean; hasFigures: boolean; isNoisy: boolean; ocrConfidence: number };

export interface ClassifyExtractResult {
  docKind: DocKind;
  textLayer: "born_digital" | "scanned" | "mixed" | "none";
  pipeline: DocPipeline;
  confidence: number;
  reason: string;
  language: string | null;
  title: string | null;
  pageCount: number;
  pages: ExtractedPage[];
  pageMeta: PageMeta[];
}

const DOC_KINDS: DocKind[] = [
  "lecture_slides", "textbook_chapter", "research_paper", "handwritten_notes",
  "scanned_worksheet", "exam_paper", "table_dataset", "diagram_image",
  "plain_text", "generic_text", "unknown",
];

export function extractPlainText(bytes: Uint8Array): ExtractedPage[] {
  return [{ pageNo: 1, markdown: Buffer.from(bytes).toString("utf-8").replace(/^﻿/, "") }];
}

const CLASSIFY_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["doc_kind", "confidence", "reason", "language", "title"],
  properties: {
    doc_kind: { type: "string", enum: DOC_KINDS },
    confidence: { type: "number" },
    reason: { type: "string" },
    language: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
  },
};

interface RawClassification {
  doc_kind: string;
  confidence: number;
  reason: string;
  language: string | null;
  title: string | null;
}

const CLASSIFY_SAMPLE_CHARS = 6000;

export async function classifyExtractedText(
  pages: ExtractedPage[],
  filename: string,
  pipeline: DocPipeline,
  opts: {
    fixed?: { docKind: DocKind; reason: string };
    textLayer?: ClassifyExtractResult["textLayer"];
    pageMeta?: PageMeta[];
  } = {}
): Promise<ClassifyExtractResult> {
  const textLayer = opts.textLayer ?? "born_digital";
  const base = {
    textLayer,
    pipeline,
    pageCount: pages.length,
    pages,
    pageMeta:
      opts.pageMeta ??
      pages.map((p) => ({ pageNo: p.pageNo, hasTables: /^\|.*\|$/m.test(p.markdown), hasFigures: false, isNoisy: false, ocrConfidence: 1 })),
  };

  if (opts.fixed) {
    return { ...base, docKind: opts.fixed.docKind, confidence: 1, reason: opts.fixed.reason, language: null, title: filename };
  }

  const sample = pages.map((p) => p.markdown).join("\n\n").slice(0, CLASSIFY_SAMPLE_CHARS);
  const provenance =
    textLayer === "born_digital"
      ? "The text below was read from the file's own digital text."
      : "The text below was transcribed from scanned page images or photos; [illegible] marks unreadable spans.";

  try {
    const raw = await chatJson<RawClassification>(
      FAST_MODEL,
      `Classify this document into exactly one doc_kind.
Kinds: lecture_slides, textbook_chapter, research_paper, handwritten_notes (hand-written),
scanned_worksheet, exam_paper, table_dataset, diagram_image (mostly a figure/diagram),
plain_text (unstructured notes/text), generic_text (any other document), unknown.
confidence is 0 to 1. reason is one sentence. title is the document's own title, or null.
language is the ISO code of the main language, or null.

Filename: ${filename}
${provenance}

---
${sample}`,
      CLASSIFY_SCHEMA
    );
    return {
      ...base,
      docKind: (DOC_KINDS.includes(raw.doc_kind as DocKind) ? raw.doc_kind : "generic_text") as DocKind,
      confidence: Math.min(1, Math.max(0, raw.confidence ?? 0)),
      reason: raw.reason || "",
      language: raw.language ?? null,
      title: raw.title || filename,
    };
  } catch (err) {
    console.warn(`[classify] classification failed for ${filename}, defaulting:`, err);
    return { ...base, docKind: "generic_text", confidence: 0, reason: "Classifier unavailable; defaulted.", language: null, title: filename };
  }
}
