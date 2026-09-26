"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { logout } from "@/actions/auth"
import { LogOut, Settings, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface UserProfile {
  name: string | null
  email: string | null
  college: string | null
  profile_pic?: string | null
}

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from("users")
          .select("name, college, profile_pic")
          .eq("id", user.id)
          .maybeSingle()

        setProfile({
          name: data?.name ?? user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          college: data?.college ?? null,
          profile_pic: data?.profile_pic ?? null,
        })
      }
    }

    fetchProfile()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [open])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  const handleViewProfile = () => {
    setOpen(false)
    router.push("/profile")
  }

  const handleEditProfile = () => {
    setOpen(false)
    router.push("/setup")
  }

  // Derive initials
  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "ME"

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white text-black font-mono font-bold text-[12px] transition-all overflow-hidden p-0"
        suppressHydrationWarning
        aria-label="User menu"
        aria-expanded={open}
      >
        {profile?.profile_pic ? (
          <img src={profile.profile_pic} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+8px)] w-[220px] glass-strong border border-white/10 rounded-2xl overflow-hidden z-[100]"
          >
            {/* Profile Summary */}
            <div className="px-4 py-3 border-b-[2px] border-border bg-background">
              <p className="font-heading font-bold text-[14px] text-foreground truncate">
                {profile?.name ?? "Loading…"}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                {profile?.email ?? ""}
              </p>
              {profile?.college && (
                <p className="font-mono text-[11px] text-muted-foreground/70 truncate">
                  {profile.college}
                </p>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={handleViewProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 font-sans font-medium text-[14px] text-foreground hover:bg-white/10 transition-colors text-left"
              >
                <User className="w-4 h-4 shrink-0" />
                View Profile
              </button>

              <button
                onClick={handleEditProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 font-sans font-medium text-[14px] text-foreground hover:bg-white/10 transition-colors text-left"
              >
                <Settings className="w-4 h-4 shrink-0" />
                Edit Profile
              </button>

              <div className="h-[2px] bg-muted mx-4 my-1" />

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 font-sans font-medium text-[14px] text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition-colors text-left disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {isLoggingOut ? "Signing out…" : "Log Out"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
