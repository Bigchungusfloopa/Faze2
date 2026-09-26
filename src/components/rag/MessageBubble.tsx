"use client"

import { Fragment } from "react"
import type { ChatMessage } from "@/hooks/useRagChat"
import { VerdictBadge } from "./VerdictBadge"

const MARKER_RE = /\[(\d+)\]/g;

/** Splits text on [n] markers and renders each as a clickable pill scrolling to its source card. */
function renderWithCitations(text: string, onCitationClick: (marker: number) => void) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(MARKER_RE)
  let key = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    const marker = parseInt(match[1], 10)
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => onCitationClick(marker)}
        className="inline-flex items-center justify-center align-middle mx-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold hover:opacity-80"
      >
        {marker}
      </button>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
  return parts
}

const STAGE_LABELS: Record<string, string> = {
  rewriting: "Thinking about your question…",
  retrieving: "Searching your documents…",
  reranking: "Weighing the evidence…",
  generating: "Writing an answer…",
}

export function MessageBubble({
  message,
  onCitationClick,
}: {
  message: ChatMessage
  onCitationClick: (marker: number) => void
}) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl border-[2px] border-foreground bg-primary text-primary-foreground px-3 py-2 text-sm shadow-[2px_2px_0px_black]">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl border-[2px] border-foreground bg-card px-3 py-2 text-sm shadow-[2px_2px_0px_black] flex flex-col gap-2">
        {message.stage && (
          <p className="text-xs text-muted-foreground italic animate-pulse">
            {STAGE_LABELS[message.stage] ?? message.stage}
            {message.subQueries && message.subQueries.length > 1 && (
              <span className="block mt-1 not-italic">
                {message.subQueries.map((q, i) => (
                  <span key={i} className="block">· {q}</span>
                ))}
              </span>
            )}
          </p>
        )}
        {message.text && <p className="whitespace-pre-wrap leading-relaxed">{renderWithCitations(message.text, onCitationClick)}</p>}
        {message.grounding && <VerdictBadge grounding={message.grounding} />}
        {message.grounding?.missing && message.grounding.missing.length > 0 && (
          <p className="text-xs text-muted-foreground">{message.grounding.missing.join(" ")}</p>
        )}
      </div>
    </div>
  )
}
