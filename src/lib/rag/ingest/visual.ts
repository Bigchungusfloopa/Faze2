import { getDocumentProxy, extractText, renderPageAsImage } from "unpdf";
import { chatText } from "@/lib/ai/mistral";
import { VISION_MODEL } from "@/lib/ai/models";
import type { ExtractedPage } from "./chunk";

// A page with less real text than this is treated as a scan and read by the
// vision model; above it, the PDF's own text layer is exact and free.
const MIN_TEXT_CHARS = 40;
const MAX_VISION_PAGES = 60;
const VISION_CONCURRENCY = 2;
const RENDER_SCALE = 2;

const TRANSCRIBE_PROMPT = `Transcribe this document page exactly, as GitHub-flavoured markdown.
- Keep the heading hierarchy (#, ##, ###).
- Render every table as a markdown table.
- Mark any word or number you cannot read with certainty as [illegible]. Never guess
  at numbers, dates, names or formulae: [illegible] is always better than a plausible invention.
- If the page has no text at all, write one line: ![figure: <short factual description>]
Output only the transcription.`;

export interface VisualExtraction {
  pages: ExtractedPage[];
  pageMeta: Array<{ pageNo: number; hasTables: boolean; hasFigures: boolean; isNoisy: boolean; ocrConfidence: number }>;
  textLayer: "born_digital" | "scanned" | "mixed";
}

async function transcribe(dataUrl: string): Promise<string> {
  const text = await chatText(VISION_MODEL, [
    { role: "user", content: [{ type: "text", text: TRANSCRIBE_PROMPT }, { type: "image_url", image_url: dataUrl }] },
  ]);
  return text.replace(/^```(?:markdown)?\s*\n?|\n?```\s*$/g, "").trim();
}

function meta(pageNo: number, markdown: string, viaVision: boolean) {
  return {
    pageNo,
    hasTables: /^\|.*\|\s*$/m.test(markdown),
    hasFigures: markdown.includes("![figure:"),
    isNoisy: viaVision && markdown.includes("[illegible]"),
    ocrConfidence: viaVision ? (markdown.includes("[illegible]") ? 0.7 : 0.9) : 1,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export async function extractPdf(bytes: Uint8Array): Promise<VisualExtraction> {
  // pdf.js takes ownership of (detaches) the buffer it's given; hand each call its own copy.
  const pdf = await getDocumentProxy(bytes.slice());
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const scanned = text.map((t, i) => ({ pageNo: i + 1, text: t.trim() })).filter((p) => p.text.length < MIN_TEXT_CHARS);
  if (scanned.length > MAX_VISION_PAGES) {
    throw new Error(`This PDF has ${scanned.length} scanned pages; the limit is ${MAX_VISION_PAGES}. Split it into smaller files.`);
  }

  const visionText = new Map<number, string>();
  await mapLimit(scanned, VISION_CONCURRENCY, async ({ pageNo }) => {
    const png = await renderPageAsImage(bytes.slice(), pageNo, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: RENDER_SCALE,
    });
    visionText.set(pageNo, await transcribe(`data:image/png;base64,${Buffer.from(png).toString("base64")}`));
  });

  const pages: ExtractedPage[] = [];
  const pageMeta: VisualExtraction["pageMeta"] = [];
  for (let n = 1; n <= totalPages; n++) {
    const viaVision = visionText.has(n);
    const markdown = viaVision ? visionText.get(n)! : text[n - 1].trim();
    if (!markdown) continue;
    pages.push({ pageNo: n, markdown });
    pageMeta.push(meta(n, markdown, viaVision));
  }

  const textLayer = scanned.length === 0 ? "born_digital" : scanned.length === totalPages ? "scanned" : "mixed";
  return { pages, pageMeta, textLayer };
}

export async function extractImage(bytes: Uint8Array, mimeType: string): Promise<VisualExtraction> {
  const markdown = await transcribe(`data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`);
  return { pages: [{ pageNo: 1, markdown }], pageMeta: [meta(1, markdown, true)], textLayer: "scanned" };
}
