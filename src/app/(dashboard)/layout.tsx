"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { FileText, Sparkles } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import UserMenu from "@/components/user-menu"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen max-h-screen bg-background text-foreground flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%)]">
      <header className="h-[60px] shrink-0 glass-nav border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-50">
        <Link href="/research" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-black">
            <FileText size={15} />
          </span>
          <span className="font-heading text-lg tracking-tight">Faze</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/research" className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Research</span>
          </Link>
          <UserMenu />
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto relative">{children}</main>

      <Toaster
        toastOptions={{
          style: {
            background: "rgba(20,20,22,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#f5f5f5",
            borderRadius: "14px",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  )
}
