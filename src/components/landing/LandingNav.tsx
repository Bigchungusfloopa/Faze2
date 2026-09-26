"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useScroll, useMotionValueEvent, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function LandingNav() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 80) {
      setIsScrolled(true);
    } else {
      setIsScrolled(false);
    }
  });

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 w-full ${
        isScrolled ? "border-b-2 border-foreground" : "border-transparent"
      }`}
      initial={false}
      animate={{
        backgroundColor: isScrolled ? "var(--card)" : "rgba(255, 255, 255, 0)",
        borderColor: isScrolled ? "var(--foreground)" : "rgba(10, 10, 10, 0)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-1 relative z-10 hover:opacity-90 transition-opacity">
          <span className="font-display font-extrabold text-2xl tracking-tighter text-foreground px-2 py-1 bg-[#FFD600] rounded-full border-2 border-foreground">
            MODULUS
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button
              variant="outline"
              className="hidden md:inline-flex bg-card border-2 border-foreground font-display font-bold text-foreground rounded-[14px] shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all h-10 px-6"
            >
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              className="bg-[#FFD600] border-[3px] border-foreground font-display font-bold text-foreground rounded-[14px] shadow-[6px_6px_0px_black] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none hover:bg-[#FFD600]/90 transition-all h-12 px-8 text-base"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
