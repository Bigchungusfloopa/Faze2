import * as React from "react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Memphis Panel (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-[#FFD600] relative overflow-hidden flex-col justify-center items-center p-12 border-r-[3px] border-foreground">
        {/* Memphis Shapes */}
        <div className="absolute top-[10%] left-[10%] w-24 h-24 rounded-full border-[2px] border-foreground bg-[#0057FF]" />
        <div className="absolute bottom-[15%] right-[15%] w-32 h-32 rotate-[15deg] border-[2px] border-foreground bg-[#FF3CAC]" />
        <div className="absolute top-[20%] right-[20%] w-16 h-16 rotate-[45deg] border-[2px] border-foreground bg-[#FF6B00]" />
        <div className="absolute bottom-[30%] left-[20%] w-20 h-20 border-[2px] border-foreground bg-[#00C853] rounded-[8px]" />

        {/* MODULUS wordmark */}
        <div className="z-10 bg-card border-[3px] border-foreground shadow-[8px_8px_0px_black] rounded-[24px] px-10 py-8 mb-8 text-center flex flex-col items-center justify-center translate-y-[-2rem]">
          <h1 className="font-heading font-extrabold text-[48px] text-foreground tracking-tight leading-none mb-3">MODULUS</h1>
          <p className="font-mono text-[14px] tracking-wide font-medium text-foreground">STUDENT COLLABORATION PLATFORM</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full md:w-1/2 bg-card md:bg-background flex flex-col justify-center items-center p-6 md:p-12 min-h-screen relative z-10">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>
    </div>
  )
}
