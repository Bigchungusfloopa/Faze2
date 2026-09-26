// Deterministic extractors for Office and tabular formats, ported from the
// Python doc agent's router/extractors. No LLM call: these formats carry
// their structure in XML, so reading it directly is exact and free.

import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ExtractedPage } from "./chunk";

// Rows per markdown table block. The chunker keeps tables atomic, so one
// block must stay well under its token ceiling; the header repeats per block
// so every chunk is self-describing on its own.
const ROWS_PER_BLOCK = 25;
const MAX_ROWS_TOTAL = 5000;

// --- Tables -----------------------------------------------------------------

function cell(v: string): string {
  return v.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function mdTable(header: string[], rows: string[][]): string {
  const width = header.length;
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join(" | ")} |`;
  return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
}

/** One sheet -> one page of row-group tables, each titled with its row range. */
function sheetToMarkdown(name: string, grid: string[][], budget: { left: number }): string {
  const nonEmpty = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return "";
  const [header, ...body] = nonEmpty;
  const hdr = header.map((h, i) => h.trim() || `Column ${i + 1}`);

  const kept = body.slice(0, Math.max(0, budget.left));
  budget.left -= kept.length;

  const parts = [`# Sheet: ${name}`, `${body.length} data rows, columns: ${hdr.join(", ")}.`];
  for (let i = 0; i < kept.length; i += ROWS_PER_BLOCK) {
    const block = kept.slice(i, i + ROWS_PER_BLOCK);
    parts.push(`## ${name} — rows ${i + 2}–${i + 1 + block.length}`, mdTable(hdr, block));
  }
  if (kept.length < body.length) {
    parts.push(`_${body.length - kept.length} further rows not indexed (workbook row limit ${MAX_ROWS_TOTAL})._`);
  }
  return parts.join("\n\n");
}

export async function extractXlsx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const budget = { left: MAX_ROWS_TOTAL };
  const pages: ExtractedPage[] = [];

  wb.eachSheet((ws) => {
    const grid: string[][] = [];
    const cols = ws.actualColumnCount;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= cols; c++) vals.push(row.getCell(c).text ?? "");
      grid.push(vals);
    });
    const md = sheetToMarkdown(ws.name, grid, budget);
    if (md) pages.push({ pageNo: pages.length + 1, markdown: md });
  });
  return pages;
}

/** RFC 4180-style parser: quoted fields, escaped quotes, embedded newlines. */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function extractCsv(bytes: Uint8Array, filename: string): ExtractedPage[] {
  const text = Buffer.from(bytes).toString("utf-8").replace(/^﻿/, "");
  const delim = filename.toLowerCase().endsWith(".tsv") ? "\t" : ",";
  const md = sheetToMarkdown(filename, parseDelimited(text, delim), { left: MAX_ROWS_TOTAL });
  return md ? [{ pageNo: 1, markdown: md }] : [];
}

// --- XML helpers --------------------------------------------------------------

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function runsText(xml: string, tag: "w" | "a"): string {
  const re = tag === "w"
    ? /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g
    : /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\/>/g;
  let out = "";
  for (const m of xml.matchAll(re)) {
    if (m[1] !== undefined) out += decode(m[1]);
    else out += m[0].includes("tab") ? "\t" : "\n";
  }
  return out;
}

// --- DOCX ---------------------------------------------------------------------

export async function extractDocx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Not a valid .docx: word/document.xml missing");

  // Word records where it last broke pages when the file was saved, so these
  // markers give real page numbers for citations, not just one giant page 1.
  const pages: string[][] = [[]];
  const newPage = () => pages.push([]);
  const blockRe = /<w:tbl[\s>][\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/g;

  for (const [block] of xml.matchAll(blockRe)) {
    const breaks = (block.match(/<w:lastRenderedPageBreak\/>|<w:br [^>]*w:type="page"[^>]*\/>/g) ?? []).length;
    for (let i = 0; i < breaks; i++) newPage();

    if (block.startsWith("<w:tbl")) {
      const rows = [...block.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map(([tr]) =>
        [...tr.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map(([tc]) => runsText(tc, "w").replace(/\s+/g, " ").trim())
      );
      if (rows.length > 0) pages[pages.length - 1].push(mdTable(rows[0], rows.slice(1)));
      continue;
    }

    const text = runsText(block, "w").trim();
    if (!text) continue;
    const style = /<w:pStyle w:val="([^"]+)"/.exec(block)?.[1] ?? "";
    const heading = /^Heading(\d)$/i.exec(style);
    let line = text;
    if (/^Title$/i.test(style)) line = `# ${text}`;
    else if (heading) line = `${"#".repeat(Math.min(6, Number(heading[1]) + 1))} ${text}`;
    else if (block.includes("<w:numPr>")) line = `- ${text}`;
    pages[pages.length - 1].push(line);
  }

  return pages
    .map((lines, i) => ({ pageNo: i + 1, markdown: lines.join("\n\n") }))
    .filter((p) => p.markdown.trim().length > 0)
    .map((p, i) => ({ ...p, pageNo: i + 1 }));
}

// --- PPTX ---------------------------------------------------------------------

function slideText(xml: string): string {
  const out: string[] = [];
  for (const [sp] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>|<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
    if (sp.startsWith("<p:graphicFrame")) {
      const rows = [...sp.matchAll(/<a:tr[\s>][\s\S]*?<\/a:tr>/g)].map(([tr]) =>
        [...tr.matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>/g)].map(([tc]) => runsText(tc, "a").replace(/\s+/g, " ").trim())
      );
      if (rows.length > 0) out.push(mdTable(rows[0], rows.slice(1)));
      continue;
    }
    const isTitle = /<p:ph[^>]*type="(title|ctrTitle)"/.test(sp);
    const paras = [...sp.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)]
      .map(([p]) => runsText(p, "a").trim())
      .filter(Boolean);
    if (paras.length === 0) continue;
    if (isTitle) out.unshift(`# ${paras.join(" ")}`);
    else out.push(paras.map((p) => `- ${p}`).join("\n"));
  }
  return out.join("\n\n");
}

export async function extractPptx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]));

  const pages: ExtractedPage[] = [];
  for (const [path, num] of slideFiles) {
    const xml = await zip.file(path)!.async("string");
    let md = slideText(xml);

    const rels = await zip.file(`ppt/slides/_rels/slide${num}.xml.rels`)?.async("string");
    const notesTarget = rels && /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
    if (notesTarget) {
      const notesXml = await zip.file(`ppt/notesSlides/${notesTarget}`)?.async("string");
      const notes = notesXml
        ? [...notesXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
            .filter(([sp]) => /<p:ph[^>]*type="body"/.test(sp))
            .map(([sp]) => runsText(sp, "a").trim())
            .join("\n")
            .trim()
        : "";
      if (notes) md += `\n\n**Speaker notes:** ${notes}`;
    }
    pages.push({ pageNo: Number(num), markdown: md.trim() || `_Slide ${num} has no text._` });
  }
  return pages;
}
