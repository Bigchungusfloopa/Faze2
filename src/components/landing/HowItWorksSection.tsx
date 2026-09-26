"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Folder, Users, Zap } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Create your Vault",
    desc: "Upload notes, create rich text notes, organise with folders and tags. Everything private until you choose to share.",
    icon: Folder,
    side: "left"
  },
  {
    num: "02",
    title: "Join or build a Community",
    desc: "Find your course community or build one. Share resources, track tasks together, discuss anything.",
    icon: Users,
    side: "right"
  },
  {
    num: "03",
    title: "Study together in real time",
    desc: "Open a Study Circle, jump on voice or video, draw on a shared whiteboard, track your focus hours.",
    icon: Zap,
    side: "left"
  }
];

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={containerRef} className="py-32 bg-background w-full relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 relative z-10">
        
        <div className="text-center mb-24">
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-foreground">
            From signup to studying in three steps.
          </h1>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Timeline SVG */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-4 md:w-16 hidden md:block">
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox="0 0 10 100" 
              preserveAspectRatio="none"
            >
              <line 
                x1="5" y1="0" x2="5" y2="100" 
                stroke="rgba(10, 10, 10, 0.2)" 
                strokeWidth="2" 
                strokeDasharray="4 4" 
              />
              <motion.line 
                x1="5" y1="0" x2="5" y2="100" 
                stroke="var(--foreground)" 
                strokeWidth="3" 
                style={{ pathLength }}
              />
            </svg>
          </div>

          <div className="flex flex-col gap-12 md:gap-32 w-full relative z-10 py-10">
            {steps.map((step, idx) => {
              const isLeft = step.side === "left";
              return (
                <div 
                  key={step.num}
                  className={`flex flex-col md:flex-row items-center w-full ${isLeft ? "md:justify-start" : "md:justify-end"} relative`}
                >
                  <motion.div
                    initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-150px" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`w-full md:w-[45%] bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] p-8 md:p-12 relative overflow-hidden`}
                  >
                    {/* Watermark Number */}
                    <div className="absolute -bottom-10 -right-6 font-display font-extrabold text-[12rem] leading-none text-foreground/5 select-none pointer-events-none">
                      {step.num}
                    </div>

                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-[1rem] bg-[#FFD600] border-2 border-foreground flex items-center justify-center mb-8 shadow-[4px_4px_0px_black]">
                        <step.icon className="w-8 h-8 text-foreground" />
                      </div>
                      <h3 className="font-display font-bold text-2xl lg:text-3xl mb-4 text-foreground">
                        {step.title}
                      </h3>
                      <p className="font-sans text-lg text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>

                    {/* Desktop Connector Dot */}
                    <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-[3px] border-foreground bg-[#FFD600] ${isLeft ? "-right-[calc(11%_+_12px)] xl:-right-[calc(11%_+_28px)]" : "-left-[calc(11%_+_12px)] xl:-left-[calc(11%_+_28px)]"}`} />
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
