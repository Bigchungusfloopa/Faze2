"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileText, RotateCw, Trash2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { DocumentRow } from "@/types/rag"

const STAGE_LABELS: Record<string, string> = {
  uploaded: "Queued",
  classifying: "Classifying",
  extracting: "Extracting",
  contextualizing: "Contextualizing",
  chunking: "Chunking",
  embedding: "Embedding",
  done: "Ready",
  failed: "Failed",
}

const KIND_LABELS: Record<string, string> = {
  lecture_slides: "Lecture slides",
  textbook_chapter: "Textbook chapter",
  research_paper: "Research paper",
  handwritten_notes: "Handwritten notes",
  scanned_worksheet: "Scanned worksheet",
  exam_paper: "Exam paper",
  table_dataset: "Table dataset",
  diagram_image: "Diagram / image",
  plain_text: "Plain text",
  generic_text: "Document",
  unknown: "Unclassified",
}

const PIPELINE_LABELS: Record<string, string> = {
  native_text: "native text",
  vision_ocr: "vision OCR",
  image_single: "image",
  plain_text: "plain text",
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentPipelineCard({ doc }: { doc: DocumentRow }) {
  const queryClient = useQueryClient()

  const reprocess = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Retry failed")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })

  const isActive = doc.status === "pending_upload" || doc.status === "queued" || doc.status === "processing"
  const isFailed = doc.status === "failed"
  const isReady = doc.status === "ready"

  return (
    <div className="border-[2px] border-foreground rounded-xl bg-card p-4 shadow-[3px_3px_0px_black] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="w-5 h-5 shrink-0 mt-0.5 text-foreground/70" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" title={doc.title}>{doc.title}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFailed && (
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              title="Retry"
              disabled={reprocess.isPending}
              onClick={() => reprocess.mutate()}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            title="Delete"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {(doc.doc_kind || doc.pipeline) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {doc.doc_kind && (
            <Badge variant="secondary">{KIND_LABELS[doc.doc_kind] ?? doc.doc_kind}</Badge>
          )}
          {doc.pipeline && (
            <Badge variant="outline">{PIPELINE_LABELS[doc.pipeline] ?? doc.pipeline}</Badge>
          )}
          {doc.page_count != null && (
            <Badge variant="outline">{doc.page_count} pg</Badge>
          )}
        </div>
      )}

      {isActive && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">{STAGE_LABELS[doc.stage] ?? doc.stage}</span>
            <span className="text-muted-foreground">{doc.progress_pct}%</span>
          </div>
          <Progress value={doc.progress_pct} />
          {doc.stage_detail && (
            <p className="text-[11px] text-muted-foreground truncate">{doc.stage_detail}</p>
          )}
        </div>
      )}

      {isFailed && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{doc.error ?? "Ingestion failed."}</span>
        </div>
      )}

      {isReady && (
        <p className="text-xs text-muted-foreground">
          {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"} indexed
        </p>
      )}
    </div>
  )
}
