"use client"

import { CheckCircle2, AlertTriangle, HelpCircle, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ChatGrounding } from "@/hooks/useRagChat"

const CONFIG: Record<
  ChatGrounding["verdict"],
  { label: string; icon: typeof CheckCircle2; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  answered: { label: "Answered", icon: CheckCircle2, variant: "default" },
  no_retrieval: { label: "Answered", icon: CheckCircle2, variant: "secondary" },
  partial: { label: "Partially supported", icon: AlertTriangle, variant: "outline" },
  insufficient_evidence: { label: "Not in your documents", icon: HelpCircle, variant: "destructive" },
  conflicting_evidence: { label: "Sources disagree", icon: Scale, variant: "outline" },
}

export function VerdictBadge({ grounding }: { grounding: ChatGrounding }) {
  const cfg = CONFIG[grounding.verdict] ?? CONFIG.answered
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  )
}
