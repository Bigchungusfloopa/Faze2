"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, FileText, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

type Mode = "login" | "signup" | "reset" | "update";

const COPY: Record<Mode, { title: string; subtitle: string; button: string; busy: string }> = {
  login: { title: "Welcome to Birbal", subtitle: "Sign in to unlock intelligent document intelligence.", button: "Sign in", busy: "Signing in…" },
  signup: { title: "Join Birbal", subtitle: "Create an account to start asking your documents questions.", button: "Create account", busy: "Creating account…" },
  reset: { title: "Reset password", subtitle: "We'll email you a link to set a new password.", button: "Send reset link", busy: "Sending…" },
  update: { title: "Set a new password", subtitle: "Choose a new password for your account.", button: "Save password", busy: "Saving…" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 14,
  padding: "13px 16px",
  color: "#fff",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  outline: "none",
  marginBottom: 10,
};

export default function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = COPY[mode];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/reset/confirm`,
        });
        if (error) throw error;
        setNotice("If an account exists for that email, a reset link is on its way.");
        return;
      }

      if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/chat");
        return;
      }

      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not create account.");
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-shell" style={{ background: "#000" }}>
      {/* Video background */}
      <video className="page-video-bg" autoPlay muted loop playsInline>
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      {/* Dark scrim */}
      <div className="page-video-scrim" />

      {/* Back link */}
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "rgba(255,255,255,0.5)",
          fontSize: 13,
          textDecoration: "none",
          padding: "20px 24px",
          transition: "color 0.2s",
          zIndex: 2,
          position: "relative",
          opacity: busy ? 0.4 : 1,
          pointerEvents: busy ? "none" : "auto",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
      >
        <ArrowLeft size={14} /> Back to Home
      </Link>

      {/* Center card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Logo + title */}
          <div
            className="anim"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 28,
              ["--d" as string]: "0.05s",
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "#fff",
                display: "grid",
                placeItems: "center",
                color: "#000",
                marginBottom: 16,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.12), 0 0 32px rgba(255,255,255,0.18)",
              }}
            >
              <FileText size={22} />
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 4vw, 30px)",
                letterSpacing: "-0.04em",
                color: "#fff",
                textAlign: "center",
              }}
            >
              {copy.title}
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--muted)",
                textAlign: "center",
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              {copy.subtitle}
            </p>
          </div>

          {/* Frosted glass card */}
          <form
            onSubmit={submit}
            className="anim"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              backdropFilter: "blur(32px) saturate(200%)",
              WebkitBackdropFilter: "blur(32px) saturate(200%)",
              borderRadius: 28,
              padding: "28px 26px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
              ["--d" as string]: "0.15s",
            }}
          >
            {/* Top shimmer edge */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 32,
                right: 32,
                height: 1,
                background: "linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent)",
              }}
            />

            {mode === "signup" && (
              <input className="auth-input" style={inputStyle} placeholder="Full name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            )}
            {mode !== "update" && (
              <input className="auth-input" style={inputStyle} type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            {mode !== "reset" && (
              <div style={{ position: "relative" }}>
                <input
                  className="auth-input"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "login" ? "Password" : "Password (min. 8 characters)"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "login" ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 12, top: 13, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {error && (
              <p style={{ color: "#f87171", fontSize: 13, margin: "2px 0 10px", lineHeight: 1.5 }}>{error}</p>
            )}
            {notice && (
              <p style={{ color: "#4ade80", fontSize: 13, margin: "2px 0 10px", lineHeight: 1.5 }}>{notice}</p>
            )}

            {/* Primary action -- main's "Continue with Email" button style */}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "13px 16px",
                borderRadius: 14,
                background: "#fff",
                border: "1px solid #fff",
                backdropFilter: "blur(8px)",
                color: "#111",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                marginTop: 6,
                opacity: busy ? 0.55 : 1,
                transition: "background 0.2s, transform 0.15s, box-shadow 0.2s",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.15), 0 0 18px rgba(255,255,255,0.1)",
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.background = "#fff";
              }}
            >
              {busy ? <Spinner /> : <Mail size={16} />}
              {busy ? copy.busy : copy.button}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            </div>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              {mode === "login" && (
                <>
                  New to Birbal? <AuthLink href="/signup">Create an account</AuthLink>
                  <br />
                  <AuthLink href="/reset">Forgot password?</AuthLink>
                </>
              )}
              {mode === "signup" && (
                <>
                  Already have an account? <AuthLink href="/login">Sign in</AuthLink>
                </>
              )}
              {(mode === "reset" || mode === "update") && (
                <>
                  Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
                </>
              )}
            </p>

            <p
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              By continuing you agree to our{" "}
              <a href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline", textUnderlineOffset: 2 }}>Terms</a>
              {" "}and{" "}
              <a href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ color: "#fff", textDecoration: "underline", textUnderlineOffset: 3 }}>
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid rgba(0,0,0,0.2)",
        borderTopColor: "#111",
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}
