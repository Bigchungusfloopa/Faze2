// Structure-aware chunking. Pure function, no I/O -- this is what makes it
// unit-testable without any API key or network access.

export interface ExtractedPage {
  pageNo: number;
  markdown: string;
}

export type ChunkContentKind = "prose" | "table" | "code" | "formula" | "slide";

export interface ChunkDraft {
  chunkIndex: number;
  content: string;
  contentKind: ChunkContentKind;
  pageFrom: number;
  pageTo: number;
  sectionPath: string[];
  heading: string | null;
  tokenCount: number;
}

const TARGET_TOKENS = 700;
const MAX_TOKENS = 1200;
const MIN_TOKENS = 10;
const CHARS_PER_TOKEN = 4; // no tokenizer dependency; a rough estimate is enough for a size budget
const OVERLAP_PARAGRAPHS = 1; // carry the last paragraph of one chunk into the next

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

interface PageSpan {
  pageNo: number;
  start: number;
  end: number;
}

function concatenatePages(pages: ExtractedPage[]): { text: string; spans: PageSpan[] } {
  let text = "";
  const spans: PageSpan[] = [];
  for (const p of pages) {
    const start = text.length;
    text += p.markdown;
    spans.push({ pageNo: p.pageNo, start, end: text.length });
    text += "\n\n";
  }
  return { text, spans };
}

function pageAt(spans: PageSpan[], charIndex: number): number {
  for (const s of spans) {
    if (charIndex >= s.start && charIndex <= s.end) return s.pageNo;
  }
  let best = spans[0]?.pageNo ?? 1;
  for (const s of spans) if (s.start <= charIndex) best = s.pageNo;
  return best;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const FENCE_RE = /^```/;
const DISPLAY_MATH_RE = /^\$\$\s*$/;

interface Section {
  sectionPath: string[];
  heading: string | null;
  start: number; // char offset where this section's own content begins (after the heading line)
  end: number;
}

/** Splits the concatenated text into sections at heading-line boundaries. */
function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  const stack: { level: number; title: string }[] = [];
  let offset = 0;
  let sectionStart = 0;
  let currentPath: string[] = [];
  let currentHeading: string | null = null;

  const pushSection = (end: number) => {
    if (end > sectionStart) {
      sections.push({ sectionPath: [...currentPath], heading: currentHeading, start: sectionStart, end });
    }
  };

  for (const line of lines) {
    const m = HEADING_RE.exec(line);
    if (m) {
      pushSection(offset);
      const level = m[1].length;
      const title = m[2].trim();
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
      currentPath = stack.map((s) => s.title);
      currentHeading = title;
      sectionStart = offset + line.length + 1;
    }
    offset += line.length + 1;
  }
  pushSection(text.length);

  if (sections.length === 0) {
    sections.push({ sectionPath: [], heading: null, start: 0, end: text.length });
  }
  return sections;
}

type Segment =
  | { kind: "prose"; text: string; start: number; end: number }
  | { kind: "table" | "code" | "formula"; text: string; start: number; end: number };

/** Walks one section's text and separates atomic blocks (tables, code, display math) from prose paragraphs. */
function segmentSection(text: string, sectionStart: number): Segment[] {
  const lines = text.split("\n");
  const segments: Segment[] = [];
  let i = 0;
  let offset = sectionStart;
  let paraBuf: string[] = [];
  let paraStart = offset;

  const flushPara = (end: number) => {
    const joined = paraBuf.join("\n").trim();
    if (joined.length > 0) segments.push({ kind: "prose", text: joined, start: paraStart, end });
    paraBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      flushPara(offset);
      const blockStart = offset;
      const blockLines = [line];
      let consumed = line.length + 1;
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        blockLines.push(lines[i]);
        consumed += lines[i].length + 1;
        i++;
      }
      if (i < lines.length) {
        blockLines.push(lines[i]); // closing fence
        consumed += lines[i].length + 1;
        i++;
      }
      offset = blockStart + consumed;
      segments.push({ kind: "code", text: blockLines.join("\n"), start: blockStart, end: offset });
      paraStart = offset;
      continue;
    }

    if (DISPLAY_MATH_RE.test(line)) {
      flushPara(offset);
      const blockStart = offset;
      const blockLines = [line];
      let consumed = line.length + 1;
      i++;
      while (i < lines.length && !DISPLAY_MATH_RE.test(lines[i])) {
        blockLines.push(lines[i]);
        consumed += lines[i].length + 1;
        i++;
      }
      if (i < lines.length) {
        blockLines.push(lines[i]);
        consumed += lines[i].length + 1;
        i++;
      }
      offset = blockStart + consumed;
      segments.push({ kind: "formula", text: blockLines.join("\n"), start: blockStart, end: offset });
      paraStart = offset;
      continue;
    }

    // A markdown table: this line has a pipe, and the next line is a header separator.
    const next = lines[i + 1];
    const looksLikeTableStart =
      line.includes("|") && next !== undefined && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(next);
    if (looksLikeTableStart) {
      flushPara(offset);
      const blockStart = offset;
      const blockLines: string[] = [];
      let consumed = 0;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        blockLines.push(lines[i]);
        consumed += lines[i].length + 1;
        i++;
      }
      offset = blockStart + consumed;
      segments.push({ kind: "table", text: blockLines.join("\n"), start: blockStart, end: offset });
      paraStart = offset;
      continue;
    }

    if (line.trim() === "") {
      flushPara(offset);
      paraStart = offset + line.length + 1;
    } else {
      paraBuf.push(line);
    }
    offset += line.length + 1;
    i++;
  }
  flushPara(offset);

  return segments;
}

const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+/;

/**
 * A "paragraph" from segmentSection() is just lines with no blank line between
 * them -- one unbroken run of prose with no blank-line break can produce a
 * single paragraph far larger than MAX_TOKENS, which packProse() would then
 * emit whole, with no upper bound. Split any such paragraph on sentence
 * boundaries first; if even one sentence alone exceeds the max (pathological,
 * but possible on bad OCR output with no punctuation), hard-slice it by
 * character count as a last resort so nothing unbounded ever reaches packing.
 */
function splitOversized(para: { text: string; start: number; end: number }): { text: string; start: number; end: number }[] {
  if (estimateTokens(para.text) <= MAX_TOKENS) return [para];

  const sentences = para.text.split(SENTENCE_BOUNDARY_RE);
  const pieces: { text: string; start: number; end: number }[] = [];
  let cursor = para.start;
  let buf = "";
  let bufStart = cursor;

  const flush = (endCursor: number) => {
    if (buf.length > 0) pieces.push({ text: buf, start: bufStart, end: endCursor });
    buf = "";
  };

  for (const sentence of sentences) {
    const withSpace = buf.length > 0 ? " " + sentence : sentence;
    if (buf.length > 0 && estimateTokens(buf + withSpace) > MAX_TOKENS) {
      flush(cursor);
      bufStart = cursor;
      buf = sentence;
    } else {
      buf += withSpace;
    }
    cursor += withSpace.length;

    // Last-resort hard slice: a single "sentence" alone still exceeds the max.
    while (estimateTokens(buf) > MAX_TOKENS) {
      const sliceChars = MAX_TOKENS * CHARS_PER_TOKEN;
      pieces.push({ text: buf.slice(0, sliceChars), start: bufStart, end: bufStart + sliceChars });
      buf = buf.slice(sliceChars);
      bufStart += sliceChars;
    }
  }
  flush(para.end);

  return pieces.length > 0 ? pieces : [para];
}

// The overlap carry-forward is meant for ordinary short paragraphs, so a
// reader has a sentence of lead-in context at a chunk boundary. It must NOT
// carry a paragraph that is itself already large -- splitOversized() can hand
// packProse() pieces sitting right at MAX_TOKENS, and re-inserting one of
// those as "overlap" would duplicate nearly a whole chunk's worth of text
// into the next one, then do it again at the next boundary, compounding.
const OVERLAP_TOKEN_BUDGET = 150;

function selectOverlap(
  bufParas: { text: string; start: number; end: number }[]
): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let tokens = 0;
  for (let i = bufParas.length - 1; i >= 0 && out.length < OVERLAP_PARAGRAPHS; i--) {
    const t = estimateTokens(bufParas[i].text);
    if (tokens + t > OVERLAP_TOKEN_BUDGET) break;
    out.unshift(bufParas[i]);
    tokens += t;
  }
  return out;
}

/** Packs prose segments into ~TARGET_TOKENS chunks with a one-paragraph overlap between consecutive chunks. */
function packProse(rawParagraphs: { text: string; start: number; end: number }[]): { text: string; start: number; end: number }[] {
  const paragraphs = rawParagraphs.flatMap(splitOversized);
  const packed: { text: string; start: number; end: number }[] = [];
  let bufParas: { text: string; start: number; end: number }[] = [];
  let bufTokens = 0;

  const flush = () => {
    if (bufParas.length === 0) return;
    packed.push({
      text: bufParas.map((p) => p.text).join("\n\n"),
      start: bufParas[0].start,
      end: bufParas[bufParas.length - 1].end,
    });
  };

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para.text);
    if (bufTokens > 0 && bufTokens + paraTokens > MAX_TOKENS) {
      flush();
      const overlap = selectOverlap(bufParas);
      bufParas = [...overlap];
      bufTokens = overlap.reduce((sum, p) => sum + estimateTokens(p.text), 0);
    }
    bufParas.push(para);
    bufTokens += paraTokens;
    if (bufTokens >= TARGET_TOKENS) {
      flush();
      const overlap = selectOverlap(bufParas);
      bufParas = [...overlap];
      bufTokens = overlap.reduce((sum, p) => sum + estimateTokens(p.text), 0);
    }
  }
  flush();

  return packed;
}

function chunkByHeadings(pages: ExtractedPage[]): Omit<ChunkDraft, "chunkIndex">[] {
  const { text, spans } = concatenatePages(pages);
  const sections = splitIntoSections(text);
  const drafts: Omit<ChunkDraft, "chunkIndex">[] = [];

  for (const section of sections) {
    const sectionText = text.slice(section.start, section.end);
    if (sectionText.trim().length === 0) continue;

    const segments = segmentSection(sectionText, section.start);
    const proseSegments = segments.filter((s): s is Extract<Segment, { kind: "prose" }> => s.kind === "prose");
    const packedProse = packProse(proseSegments);

    for (const p of packedProse) {
      if (estimateTokens(p.text) < MIN_TOKENS) continue;
      drafts.push({
        content: p.text,
        contentKind: "prose",
        pageFrom: pageAt(spans, p.start),
        pageTo: pageAt(spans, Math.max(p.start, p.end - 1)),
        sectionPath: section.sectionPath,
        heading: section.heading,
        tokenCount: estimateTokens(p.text),
      });
    }

    for (const seg of segments) {
      if (seg.kind === "prose") continue;
      drafts.push({
        content: seg.text,
        contentKind: seg.kind,
        pageFrom: pageAt(spans, seg.start),
        pageTo: pageAt(spans, Math.max(seg.start, seg.end - 1)),
        sectionPath: section.sectionPath,
        heading: section.heading,
        tokenCount: estimateTokens(seg.text),
      });
    }
  }

  // Segments were emitted prose-then-atomic per section, which can put a
  // table before the paragraph that introduces it. Restore document order.
  return drafts.sort((a, b) => (a.pageFrom !== b.pageFrom ? a.pageFrom - b.pageFrom : 0));
}

/** lecture_slides: one chunk per slide/page, no overlap. Slides are already atomic; overlap only pollutes them. */
function chunkOnePerPage(pages: ExtractedPage[]): Omit<ChunkDraft, "chunkIndex">[] {
  return pages
    .filter((p) => p.markdown.trim().length > 0)
    .map((p) => {
      const headingMatch = HEADING_RE.exec(p.markdown.split("\n")[0] ?? "");
      return {
        content: p.markdown.trim(),
        contentKind: "slide" as const,
        pageFrom: p.pageNo,
        pageTo: p.pageNo,
        sectionPath: headingMatch ? [headingMatch[2].trim()] : [],
        heading: headingMatch ? headingMatch[2].trim() : null,
        tokenCount: estimateTokens(p.markdown),
      };
    });
}

export function chunkDocument(pages: ExtractedPage[], docKind: string | null): ChunkDraft[] {
  const drafts = docKind === "lecture_slides" ? chunkOnePerPage(pages) : chunkByHeadings(pages);
  return drafts.map((d, i) => ({ ...d, chunkIndex: i }));
}
