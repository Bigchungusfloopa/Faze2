"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { UploadDropzone } from "@/components/rag/UploadDropzone"
import { DocumentPipelineCard } from "@/components/rag/DocumentPipelineCard"
import { ChatPanel } from "@/components/rag/ChatPanel"
import { WorkspaceSwitcher, type WorkspaceScope } from "@/components/rag/WorkspaceSwitcher"
import type { DocumentRow } from "@/types/rag"

async function fetchDocuments(workspaceId: string | null): Promise<DocumentRow[]> {
  const url = workspaceId ? `/api/documents?workspaceId=${workspaceId}` : "/api/documents"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load documents")
  const { data } = await res.json()
  return data
}

const ACTIVE_STATUSES = new Set(["pending_upload", "queued", "processing"])

export default function ResearchPage() {
  const [scope, setScope] = useState<WorkspaceScope>({ workspaceId: null, name: "Personal" })
  const queryClient = useQueryClient()

  const { data: documents = [], isLoading } = useQuery({
    // workspaceId in the key -- switching scope must not show a stale list
    // from the previous scope while the new one is still loading.
    queryKey: ["documents", scope.workspaceId],
    queryFn: () => fetchDocuments(scope.workspaceId),
    refetchInterval: (query) => {
      const rows = query.state.data ?? []
      return rows.some((d) => ACTIVE_STATUSES.has(d.status)) ? 1500 : false
    },
  })

  const handleScopeChange = (next: WorkspaceScope) => {
    setScope(next)
    queryClient.invalidateQueries({ queryKey: ["documents"] })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-extrabold text-2xl">Research</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents, watch them move through classification and indexing, then ask questions
            grounded in what they actually say.
          </p>
        </div>
        <WorkspaceSwitcher scope={scope} onScopeChange={handleScopeChange} />
      </div>

      {scope.workspaceId && (
        <p className="text-xs text-muted-foreground -mt-2">
          Working in <span className="font-bold">{scope.name}</span> — every member of this workspace can see and
          search everything uploaded here.
        </p>
      )}

      <UploadDropzone workspaceId={scope.workspaceId ?? undefined} />

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
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Ask {scope.workspaceId ? `— ${scope.name}` : ""}
        </h2>
        <ChatPanel workspaceId={scope.workspaceId} />
      </div>
    </div>
  )
}
