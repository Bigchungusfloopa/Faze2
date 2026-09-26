// File-type routing shared by the upload route (validation) and the
// ingestion pipeline (which extractor runs). Browsers report an empty or
// generic MIME type for .md, .csv and Office files often enough that the
// extension is the tiebreaker.

export type SourceFormat = "pdf" | "image" | "text" | "csv" | "xlsx" | "docx" | "pptx";

const BY_EXT: Record<string, { format: SourceFormat; mime: string }> = {
  pdf: { format: "pdf", mime: "application/pdf" },
  png: { format: "image", mime: "image/png" },
  jpg: { format: "image", mime: "image/jpeg" },
  jpeg: { format: "image", mime: "image/jpeg" },
  webp: { format: "image", mime: "image/webp" },
  txt: { format: "text", mime: "text/plain" },
  md: { format: "text", mime: "text/markdown" },
  markdown: { format: "text", mime: "text/markdown" },
  json: { format: "text", mime: "application/json" },
  csv: { format: "csv", mime: "text/csv" },
  tsv: { format: "csv", mime: "text/tab-separated-values" },
  xlsx: { format: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  docx: { format: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pptx: { format: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
};

const BY_MIME = new Map(Object.values(BY_EXT).map((v) => [v.mime, v]));

export const ACCEPTED_EXTENSIONS = Object.keys(BY_EXT).map((e) => `.${e}`);

export function resolveFormat(filename: string, mimeType: string | null | undefined) {
  const known = mimeType ? BY_MIME.get(mimeType) : undefined;
  if (known) return known;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return BY_EXT[ext] ?? null;
}
