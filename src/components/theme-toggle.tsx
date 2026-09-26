"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "theme-toggle relative flex h-9 w-9 items-center justify-center rounded-[12px] border-[2px] border-foreground bg-card text-foreground shadow-[3px_3px_0px_black] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none",
        className
      )}
    >
      <Sun className="absolute h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      <Moon className="absolute h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
    </button>
  )
}
