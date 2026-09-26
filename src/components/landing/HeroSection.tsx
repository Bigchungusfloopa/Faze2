"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowDown } from "lucide-react";

function MemphisShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-[0.08]">
      {/* Circle */}
      <motion.div
        className="absolute top-[20%] left-[10%] w-16 h-16 rounded-full border-[3px] border-foreground bg-transparent"
        animate={{ y: [0, -20, 0], rotate: [0, 45, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Triangle */}
      <motion.svg
        className="absolute top-[15%] right-[25%] w-16 h-16"
        viewBox="0 0 100 100"
        animate={{ y: [0, 30, 0], rotate: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <path d="M50 10 L90 90 L10 90 Z" fill="none" stroke="currentColor" strokeWidth="4" />
      </motion.svg>
      {/* Dots Grid */}
      <motion.div
        className="absolute bottom-[20%] left-[8%] grid grid-cols-3 gap-2"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-2 h-2 bg-foreground rounded-full" />
        ))}
      </motion.div>
      {/* Squiggle */}
      <motion.svg
        className="absolute bottom-[30%] right-[10%] w-24 h-8"
        viewBox="0 0 100 40"
        animate={{ y: [0, 15, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <path d="M0 20 Q 12.5 5, 25 20 T 50 20 T 75 20 T 100 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </motion.svg>
      {/* Star */}
      <motion.svg
        className="absolute top-[40%] right-[5%] w-12 h-12"
        viewBox="0 0 24 24"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </motion.svg>
      {/* Checker */}
      <motion.div
        className="absolute top-[60%] left-[20%] w-16 h-16 grid grid-cols-2"
        animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="bg-foreground" />
        <div className="border-2 border-foreground" />
        <div className="border-2 border-foreground" />
        <div className="bg-foreground" />
      </motion.div>
    </div>
  );
}

function FloatingProductMockup() {
  return (
    <motion.div
      className="hidden lg:block relative z-10 w-[500px]"
      animate={{ y: [-10, 10, -10] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      style={{ rotate: "2deg" }}
    >
      <div className="bg-card border-[3px] border-foreground rounded-[24px] shadow-[12px_12px_0px_black] overflow-hidden flex flex-col h-[400px]">
        {/* Mockup Header */}
        <div className="h-16 bg-[#FFD600] border-b-[3px] border-foreground px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center text-[#FFD600] font-bold font-display text-sm">
              IT
            </div>
            <span className="font-display font-bold text-lg text-foreground">Information Technology 101</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-foreground bg-card" />
            <div className="w-3 h-3 rounded-full border-2 border-foreground bg-card" />
            <div className="w-3 h-3 rounded-full border-2 border-foreground bg-card" />
          </div>
        </div>
        {/* Mockup Body */}
        <div className="flex-1 bg-background p-6 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-card border-2 border-foreground rounded-xl p-4 shadow-[4px_4px_0px_black] flex flex-col gap-3"
            >
              <div className={`w-8 h-8 rounded-md border-2 border-foreground flex items-center justify-center ${i % 2 === 0 ? 'bg-[#0057FF]' : 'bg-[#FF3CAC]'}`}>
                <div className="w-4 h-4 bg-card rounded-sm border border-foreground" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-foreground/10 rounded-full" />
                <div className="h-2.5 w-2/3 bg-foreground/10 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function HeroSection() {
  const scrollToNext = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth"
    });
  };

  return (
    <section className="relative min-h-screen bg-card flex items-center pt-20 overflow-hidden">
      <MemphisShapes />

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 w-full flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 relative z-10 py-16">

        {/* Left Content */}
        <div className="max-w-xl xl:max-w-2xl flex flex-col items-start text-left shrink-0">

          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#FFD600] scale-105 transform -rotate-2" />
            <span className="relative z-10 font-mono text-sm tracking-[0.2em] uppercase font-bold text-foreground px-1">
              The Student OS
            </span>
          </div>

          <h1 className="font-display font-extrabold text-[clamp(2.75rem,5vw,5.5rem)] leading-[1.05] tracking-tight mb-8">
            Everything your study life needs.{" "}
            <span className="relative inline-block whitespace-nowrap">
              Finally
              <svg
                className="absolute w-full h-[18px] -bottom-[4px] left-0 pointer-events-none text-[#FF3B30]"
                viewBox="0 0 150 20"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2,15 C40,5 110,8 148,15"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="path-squiggle"
                />
                <path
                  d="M10,18 C60,11 120,13 140,18"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="path-squiggle"
                />
              </svg>
            </span>{" "}
            in one place.
          </h1>

          <p className="font-sans text-xl text-muted-foreground mb-10 leading-relaxed max-w-lg">
            Notes, communities, real-time study rooms, and focus tracking — built for students, not corporations.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-10 w-full sm:w-auto">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-[#FFD600] border-[3px] border-foreground font-display font-bold text-foreground rounded-[14px] shadow-[6px_6px_0px_black] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none hover:bg-[#FFD600]/90 transition-all h-14 px-8 text-lg">
                Get Started Free
              </Button>
            </Link>
            <Button
              onClick={scrollToNext}
              variant="outline"
              className="w-full sm:w-auto bg-card border-[3px] border-foreground font-display font-bold text-foreground rounded-[14px] shadow-[6px_6px_0px_black] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none transition-all h-14 px-8 text-lg"
            >
              See How It Works
              <ArrowDown className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-foreground flex items-center justify-center bg-[#0057FF] text-white font-mono text-xs font-bold z-30">AJ</div>
              <div className="w-10 h-10 rounded-full border-2 border-foreground flex items-center justify-center bg-[#FF6B00] text-foreground font-mono text-xs font-bold z-20">MK</div>
              <div className="w-10 h-10 rounded-full border-2 border-foreground flex items-center justify-center bg-[#00C853] text-foreground font-mono text-xs font-bold z-10">SR</div>
            </div>
            <p className="font-mono text-sm text-muted-foreground font-medium">
              Join students already using MODULUS
            </p>
          </div>

        </div>

        {/* Right Product Mockup */}
        <FloatingProductMockup />

      </div>
    </section>
  );
}
