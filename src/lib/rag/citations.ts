import type { EvidenceItem } from "./prompt";

export interface ParsedCitations {
  cleanedText: string; // invalid markers stripped
  usedMarkers: number[];
  invalidMarkers: number[]; // the model cited a source id that was never served -- a fabricated citation
  uncitedRatio: number; // fraction of long sentences carrying no citation at all
}

const MARKER_RE_GLOBAL = /\[(\d+)\]/g;
const MARKER_RE_TEST = /\[\d+\]/; // deliberately non-global: reusing a `g`-flagged regex across .test() calls is a classic stateful-lastIndex bug
const MIN_WORDS_FOR_CITATION_CHECK = 8;

/**
 * Strips any citation marker the model wrote that doesn't correspond to a
 * source actually served to it -- a fabricated citation is exactly the kind
 * of "looks grounded and isn't" failure this system exists to prevent, and
 * catching it costs nothing (no LLM call, just a set lookup).
 */
export function parseCitations(text: string, validMarkers: Set<number>): ParsedCitations {
  const usedMarkers = new Set<number>();
  const invalidMarkers: number[] = [];

  const cleanedText = text.replace(MARKER_RE_GLOBAL, (match, numStr) => {
    const n = parseInt(numStr, 10);
    if (validMarkers.has(n)) {
      usedMarkers.add(n);
      return match;
    }
    invalidMarkers.push(n);
    return "";
  });

  const sentences = cleanedText
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().split(/\s+/).length >= MIN_WORDS_FOR_CITATION_CHECK);
  const uncited = sentences.filter((s) => !MARKER_RE_TEST.test(s));
  const uncitedRatio = sentences.length > 0 ? uncited.length / sentences.length : 0;

  return {
    cleanedText,
    usedMarkers: Array.from(usedMarkers).sort((a, b) => a - b),
    invalidMarkers,
    uncitedRatio,
  };
}

/**
 * The full chunk is 400-1200 tokens; showing all of it as "the evidence" in
 * an evidence popover for one citation is a wall of text, not a snippet.
 * Finds the 1-2 sentences of the SOURCE content with the highest word
 * overlap against the sentence that actually cited it, so the popover shows
 * the specific claim rather than the whole passage.
 */
export function extractSnippet(sourceContent: string, citingSentence: string | null, maxSentences = 2): string {
  const sourceSentences = sourceContent.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sourceSentences.length <= maxSentences || !citingSentence) {
    return sourceSentences.slice(0, maxSentences).join(" ") || sourceContent.slice(0, 300);
  }

  const citingWords = tokenize(citingSentence);
  if (citingWords.size === 0) return sourceSentences.slice(0, maxSentences).join(" ");

  const scored = sourceSentences.map((sentence, i) => {
    const words = tokenize(sentence);
    let overlap = 0;
    for (const w of words) if (citingWords.has(w)) overlap++;
    return { sentence, i, score: overlap };
  });

  const top = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i); // restore original order

  if (top.every((t) => t.score === 0)) return sourceSentences.slice(0, maxSentences).join(" ");
  return top.map((t) => t.sentence).join(" ");
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "for",
  "and", "or", "it", "this", "that", "with", "as", "by", "be", "at", "from",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\[\d+\]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/** Finds the sentence in `text` that contains marker [n], for snippet extraction. */
export function findCitingSentence(text: string, marker: number): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const needle = `[${marker}]`;
  return sentences.find((s) => s.includes(needle)) ?? null;
}

/** Builds the frozen `message_citations` rows for one finished answer. */
export function buildCitationRows(
  answerText: string,
  parsed: ParsedCitations,
  evidence: EvidenceItem[]
): Array<{
  marker: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_from: number | null;
  page_to: number | null;
  section_path: string[];
  snippet: string;
  rerank_score: number;
  used_in_answer: boolean;
}> {
  return evidence.map((e) => {
    const used = parsed.usedMarkers.includes(e.marker);
    const citingSentence = used ? findCitingSentence(answerText, e.marker) : null;
    return {
      marker: e.marker,
      chunk_id: e.chunkId,
      document_id: e.documentId,
      document_title: e.documentTitle,
      page_from: e.pageFrom,
      page_to: e.pageTo,
      section_path: e.sectionPath,
      snippet: extractSnippet(e.snippet, citingSentence),
      rerank_score: e.rerankScore,
      used_in_answer: used,
    };
  });
}
