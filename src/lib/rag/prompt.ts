import type { RerankedChunk } from "./rerank";

export interface EvidenceItem {
  marker: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageFrom: number | null;
  pageTo: number | null;
  sectionPath: string[];
  snippet: string; // what's shown in the UI's evidence rail -- same text the prompt cites
  rerankScore: number;
}

/**
 * Assigns [1]..[N] markers, grouped by document and ordered by page so the
 * model sees each document's evidence as one coherent unit rather than
 * interleaved fragments. `content` only ever enters the prompt here -- never
 * `contextualText`, which is an LLM-generated embedding aid, not source text.
 * Showing the model its own summary as if it were evidence is exactly how a
 * "grounded" system ends up citing itself.
 */
export function assembleEvidence(chunks: RerankedChunk[]): { evidence: EvidenceItem[]; block: string } {
  const byDoc = new Map<string, RerankedChunk[]>();
  for (const c of chunks) {
    const list = byDoc.get(c.documentId) ?? [];
    list.push(c);
    byDoc.set(c.documentId, list);
  }
  for (const list of byDoc.values()) {
    list.sort((a, b) => (a.pageFrom ?? 0) - (b.pageFrom ?? 0));
  }

  // Preserve the reranker's overall preference for which document appears
  // first, using each document's best-scoring chunk.
  const docOrder = Array.from(byDoc.entries())
    .map(([docId, list]) => ({ docId, best: Math.max(...list.map((c) => c.rerankScore)) }))
    .sort((a, b) => b.best - a.best)
    .map((d) => d.docId);

  const evidence: EvidenceItem[] = [];
  const blockParts: string[] = [];
  let marker = 1;

  for (const docId of docOrder) {
    for (const c of byDoc.get(docId)!) {
      const pages = c.pageFrom === c.pageTo ? `page ${c.pageFrom}` : `pages ${c.pageFrom}-${c.pageTo}`;
      const section = c.sectionPath.length > 0 ? ` | section: ${c.sectionPath.join(" > ")}` : "";
      evidence.push({
        marker,
        chunkId: c.chunkId,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        pageFrom: c.pageFrom,
        pageTo: c.pageTo,
        sectionPath: c.sectionPath,
        snippet: c.content,
        rerankScore: c.rerankScore,
      });
      blockParts.push(
        `=== SOURCE [${marker}] ===\ndocument: "${c.documentTitle}" | ${pages}${section}\n---\n${c.content}`
      );
      marker++;
    }
  }

  return { evidence, block: blockParts.join("\n\n") };
}

export const GROUNDING_SYSTEM_INSTRUCTION = `You answer using ONLY the numbered SOURCES provided. You are talking to a
student who will act on your answer, so being wrong is far worse than being
incomplete.

CITATION
- Every factual sentence ends with one or more markers: [3] or [1][4].
- Cite the source you actually used. Never cite a source you did not read
  the claim in.
- Do not cite for your own transitions, framing, or restatements of the question.

GROUNDING AND ABSTENTION
- If the SOURCES do not contain the answer, say exactly what is missing and
  stop. Do not fill the gap from general knowledge.
- If the SOURCES answer only part of the question, answer that part, then state
  plainly which part is unsupported.
- Never infer a specific number, date, name, formula, or definition that is not
  written in a SOURCE.
- Text marked [illegible] is unreadable, not missing. Say so rather than guessing.
- "I could not find this in your documents" is a correct and useful answer.

CONFLICTS
- If two SOURCES disagree, do not silently pick one and do not average them.
  Present both positions with their citations, then note any reason one might
  be preferred (more recent, more specific, primary vs. secondary).

SYNTHESIS
- When several SOURCES each carry part of the answer, combine them explicitly
  and cite each contributing source at the point it contributes.

FORMAT
- Answer in prose. Markdown tables for comparisons. LaTeX for mathematics.
- After the answer, on its own line, write exactly one of:
  VERDICT: answered
  VERDICT: partial
  VERDICT: conflicting_evidence
  Choose "conflicting_evidence" if any SOURCES disagreed, "partial" if any
  part of the question went unanswered, otherwise "answered".`;

export function buildUserPrompt(query: string, evidenceBlock: string): string {
  return `${GROUNDING_SYSTEM_INSTRUCTION}

=== SOURCES ===
${evidenceBlock}
=== END SOURCES ===

Question: ${query}`;
}
