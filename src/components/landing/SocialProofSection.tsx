"use client";

import { motion } from "framer-motion";

const quotes = [
  {
    quote: "Finally stopped losing notes in WhatsApp groups.",
    name: "Aisha M.",
    role: "Computer Science"
  },
  {
    quote: "The focus leaderboard actually made me competitive about studying.",
    name: "David T.",
    role: "Engineering"
  },
  {
    quote: "Study circles saved my group project grade. Ephemeral rooms are genius.",
    name: "Sarah L.",
    role: "Business Studies"
  },
  {
    quote: "One link to find every past paper. No more endless scrolling.",
    name: "James K.",
    role: "Medicine"
  },
  {
    quote: "It feels like a game, but I'm actually getting straight A's.",
    name: "Nina R.",
    role: "Mathematics"
  },
  {
    quote: "Love that my private vault is completely separate from community stuff.",
    name: "Omar H.",
    role: "Architecture"
  }
];

// Duplicate original array so we can scroll infinitely without a gap
const duplicatedQuotes = [...quotes, ...quotes, ...quotes];

export default function SocialProofSection() {
  return (
    <section className="social-proof-section py-24 overflow-hidden border-y-[3px] border-foreground">
      
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 mb-16 text-center">
        <h2 className="font-display font-extrabold text-4xl text-foreground">
          Join thousands of students.
        </h2>
      </div>

      <div className="relative flex whitespace-nowrap overflow-hidden">
        <motion.div
          className="flex gap-6 px-3"
          animate={{ x: [0, -1035 * 2] }} // rough width calculation, we use percentage ideally, or a very wide distance with loop
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 40,
              ease: "linear",
            },
          }}
          // Alternative approach for smooth infinite CSS: style={{ width: 'max-content' }}
          style={{ width: "fit-content" }}
        >
          {duplicatedQuotes.map((q, idx) => (
            <div 
              key={idx} 
              className="social-proof-card w-[320px] md:w-[400px] shrink-0 bg-card dark:bg-[#1E1D1A] border-2 border-foreground rounded-[1.5rem] p-6 sm:p-8 shadow-[4px_4px_0px_black] whitespace-normal flex flex-col"
            >
              <p className="social-proof-quote font-sans italic text-lg text-foreground mb-6 flex-1">
                "{q.quote}"
              </p>
              <div>
                <p className="social-proof-name font-mono font-bold text-foreground text-sm">{q.name}</p>
                <p className="social-proof-role font-mono text-xs text-muted-foreground">{q.role}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

    </section>
  );
}
