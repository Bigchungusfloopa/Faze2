"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, ExternalLink, FileText, X } from "lucide-react";

interface Preview {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  status: string;
  url: string;
  text: string | null;
}

const frost = (alpha = 0.08, blur = 24) => ({
  background: `rgba(255,255,255,${alpha})`,
  border: "1px solid rgba(255,255,255,0.14)",
  backdropFilter: `blur(${blur}px) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
} as React.CSSProperties);

const iconBtn: React.CSSProperties = {
  display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 10,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.75)", cursor: "pointer", textDecoration: "none",
};

/** Full-screen preview window for one uploaded document (PDF, image, or extracted text). */
export default function DocPreview({ documentId, page, onClose }: { documentId: string; page?: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["preview", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/preview`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not open this file.");
      return json.data as Preview;
    },
    staleTime: 5 * 60 * 1000, // signed URLs last 10 minutes
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = data?.mimeType === "application/pdf";
  const isImage = data?.mimeType.startsWith("image/");
  const pdfSrc = data && isPdf ? `${data.url}#${page ? `page=${page}&` : ""}view=FitH` : "";

  return (
    <div
      onClick={onClose}
      className="doc-preview-overlay"
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="doc-preview-panel"
        style={{ ...frost(0.07, 28), width: "min(1000px, 100%)", height: "min(88vh, 100%)", borderRadius: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", color: "#000", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <FileText size={13} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {data?.title ?? "Loading…"}
            </div>
            {data && data.title !== data.filename && (
              <div style={{ color: "var(--muted)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.filename}</div>
            )}
          </div>
          {data && (
            <>
              <a href={data.url} target="_blank" rel="noreferrer noopener" title="Open in new tab" style={iconBtn}><ExternalLink size={15} /></a>
              <a href={data.url} download={data.filename} title="Download" style={iconBtn}><Download size={15} /></a>
            </>
          )}
          <button onClick={onClose} title="Close (Esc)" style={iconBtn}><X size={16} /></button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", background: "rgba(0,0,0,0.25)" }}>
          {isLoading && <Centered>Loading preview…</Centered>}
          {error && <Centered>{(error as Error).message}</Centered>}
          {data && isPdf && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <a href={pdfSrc} target="_blank" rel="noreferrer noopener" className="doc-preview-mobile-hint">
                Tap to open the full PDF{page ? ` at page ${page}` : ""} ↗
              </a>
              <iframe src={pdfSrc} title={data.title} style={{ flex: 1, border: "none", background: "#fff" }} />
            </div>
          )}
          {data && isImage && (
            // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL
            <img src={data.url} alt={data.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", margin: "auto" }} />
          )}
          {data && !isPdf && !isImage && (
            data.text ? (
              <div className="answer-md" style={{ padding: "22px 28px", color: "rgba(255,255,255,0.88)", fontSize: 14.5, lineHeight: 1.65, width: "100%" }}>
                <p style={{ fontSize: 11.5, color: "var(--muted)" }}>Extracted content. Download the file to see the original formatting.</p>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.text}</ReactMarkdown>
              </div>
            ) : (
              <Centered>{data.status === "ready" ? "No text could be extracted from this file." : "Still reading this file. The preview will appear once it's processed."}</Centered>
            )
          )}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: "auto", color: "var(--muted)", fontSize: 14, padding: 24, textAlign: "center" }}>{children}</div>;
}
