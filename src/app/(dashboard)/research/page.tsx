"use client"

import { useQuery } from "@tanstack/react-query"
import { UploadDropzone } from "@/components/rag/UploadDropzone"
import { DocumentPipelineCard } from "@/components/rag/DocumentPipelineCard"
import { ChatPanel } from "@/components/rag/ChatPanel"
import type { DocumentRow } from "@/types/rag"

async function fetchDocuments(): Promise<DocumentRow[]> {
  const res = await fetch("/api/documents")
  if (!res.ok) throw new Error("Failed to load documents")
  const { data } = await res.json()
  return data
}

const ACTIVE_STATUSES = new Set(["pending_upload", "queued", "processing"])

export default function ResearchPage() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
    // Poll only while something is actually moving through the pipeline.
    // Realtime broadcast would avoid the poll entirely, but for a corpus this
    // size the two are visually indistinguishable and polling is a fraction
    // of the code.
    refetchInterval: (query) => {
      const rows = query.state.data ?? []
      return rows.some((d) => ACTIVE_STATUSES.has(d.status)) ? 1500 : false
    },
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl">Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload documents, watch them move through classification and indexing, then ask questions
          grounded in what they actually say.
        </p>
      </div>

      <UploadDropzone />

      <div>
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Corpus{documents.length > 0 ? ` (${documents.length})` : ""}
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet — drop one above to get started.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((doc) => (
              <DocumentPipelineCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">Ask</h2>
        <ChatPanel />
      </div>
    </div>
  )
}
