import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading"
});

const inter = Inter({
  subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Faze",
  description: "Document intelligence — upload, ask, get grounded answers with citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} bg-background text-foreground font-sans antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
