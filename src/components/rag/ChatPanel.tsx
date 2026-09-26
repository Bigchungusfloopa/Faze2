"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRagChat } from "@/hooks/useRagChat"
import { MessageBubble } from "./MessageBubble"
import { CitationRail } from "./CitationRail"

export function ChatPanel({ documentIds }: { documentIds?: string[] }) {
  const { messages, isStreaming, send } = useRagChat()
  const [input, setInput] = useState("")
  const [activeMarker, setActiveMarker] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    void send(text, documentIds)
  }

  const handleCitationClick = (marker: number) => {
    setActiveMarker(marker)
    document.getElementById(`source-${marker}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="border-[2px] border-foreground rounded-xl bg-background shadow-[3px_3px_0px_black] flex flex-col h-[600px]">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center mt-8">
                Ask a question about your documents. Answers are grounded in what you&apos;ve uploaded, with
                citations — and the system will tell you plainly when your documents don&apos;t cover something.
              </p>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} onCitationClick={handleCitationClick} />)
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t-[2px] border-foreground p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask about your documents…"
              disabled={isStreaming}
            />
            <Button onClick={handleSend} disabled={isStreaming || !input.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {lastAssistant && lastAssistant.sources.length > 0 && (
          <div className="w-64 shrink-0 border-l-[2px] border-foreground p-3 overflow-y-auto">
            <CitationRail
              sources={lastAssistant.sources}
              activeMarker={activeMarker}
              nearMiss={lastAssistant.grounding?.verdict === "insufficient_evidence"}
            />
          </div>
        )}
      </div>
    </div>
  )
}
