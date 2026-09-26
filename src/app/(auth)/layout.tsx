import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <video className="page-video-bg" autoPlay muted loop playsInline>
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      <div className="page-video-scrim" />

      <Link href="/" className="inline-flex items-center gap-1.5 px-6 py-5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={14} /> Back to Home
      </Link>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex flex-col items-center anim">
            <div className="mb-3 grid h-13 w-13 place-items-center rounded-full bg-white p-3 text-black shadow-[0_0_32px_rgba(255,255,255,0.18)]">
              <FileText size={22} />
            </div>
            <span className="font-heading text-2xl tracking-tight text-white">Faze</span>
          </div>
          <div className="auth-card anim" style={{ ["--d" as string]: "0.12s" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
