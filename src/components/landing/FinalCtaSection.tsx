"use client";

import { motion } from "framer-motion";
import Link from "next/link";

function LargeMemphisShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <motion.svg
        initial={{ opacity: 0, scale: 0, rotate: -30 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 10 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "backOut", delay: 0.1 }}
        className="absolute top-[10%] left-[5%] md:left-[15%] w-32 h-32 md:w-48 md:h-48"
        viewBox="0 0 100 100"
      >
        <path d="M50 10 L90 90 L10 90 Z" fill="#0057FF" stroke="var(--foreground)" strokeWidth="3" />
      </motion.svg>

      <motion.svg
        initial={{ opacity: 0, scale: 0, rotate: 90 }}
        whileInView={{ opacity: 1, scale: 1, rotate: -15 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "backOut", delay: 0.2 }}
        className="absolute bottom-[15%] left-[10%] md:left-[20%] w-24 h-24 md:w-32 md:h-32"
        viewBox="0 0 24 24"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FF3CAC" stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
      </motion.svg>

      <motion.svg
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "backOut", delay: 0.3 }}
        className="absolute top-[20%] right-[10%] md:right-[20%] w-20 h-20 md:w-28 md:h-28"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="40" fill="#00C853" stroke="var(--foreground)" strokeWidth="4" />
      </motion.svg>

      <motion.svg
        initial={{ opacity: 0, x: 50, rotate: -45 }}
        whileInView={{ opacity: 1, x: 0, rotate: 15 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "backOut", delay: 0.4 }}
        className="absolute bottom-[25%] right-[5%] md:right-[15%] w-32 h-16 md:w-48 md:h-24"
        viewBox="0 0 100 40"
      >
        <path d="M0 20 Q 12.5 5, 25 20 T 50 20 T 75 20 T 100 20" fill="none" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round" />
      </motion.svg>
    </div>
  );
}

export default function FinalCtaSection() {
  return (
    <section className="relative min-h-[90vh] bg-card flex flex-col items-center justify-center overflow-hidden py-32 px-4">
      <LargeMemphisShapes />
      
      <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
        <h2 className="font-display font-extrabold text-[clamp(2.5rem,5vw,5rem)] leading-[1.1] tracking-tight mb-6">
          Your notes.<br />
          Your community.<br />
          Your focus.
        </h2>
        
        <p className="font-sans text-xl md:text-2xl text-muted-foreground mb-12">
          Stop juggling apps. Start actually studying.
        </p>

        <Link href="/signup">
          <button className="bg-[#FFD600] border-[3px] border-foreground font-display font-bold text-foreground rounded-[14px] shadow-[6px_6px_0px_black] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none hover:bg-[#FFD600]/90 transition-all h-16 px-10 text-xl flex items-center justify-center -ml-[3px]">
            Get Started Free — It's Free
          </button>
        </Link>

        <p className="font-mono text-sm text-muted-foreground/70 mt-6">
          No payment. No credit card. Just your email.
        </p>
      </div>
    </section>
  );
}
