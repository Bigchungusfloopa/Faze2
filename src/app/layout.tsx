import type { Metadata } from "next";
import { Toaster } from "sonner";
// Bundled rather than a CDN <link>: dark-mode extensions rewrite cross-origin
// stylesheet links before hydration, which React reports as a mismatch.
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Birbal — Intelligent Document Intelligence",
  description:
    "Birbal: Automated classification and NLP extraction. Extract insights from your documents in seconds.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos" rel="stylesheet" />
      </head>
      <body style={{ background: "#000", color: "#fff" }}>
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "rgba(20,20,22,0.85)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(20px) saturate(180%)",
              color: "#fff",
              borderRadius: 14,
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
