import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"], weight: ["700", "800"], variable: "--font-heading" 
});

const beVietnamPro = Be_Vietnam_Pro({ 
  subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans" 
});

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" 
});

export const metadata: Metadata = {
  title: "MODULUS",
  description: "Collaborative learning platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${beVietnamPro.variable} ${spaceGrotesk.variable} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            {children}
            <ThemeToggle className="fixed bottom-4 right-4 z-[100] md:bottom-6 md:right-6" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
