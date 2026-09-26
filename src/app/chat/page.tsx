"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  UploadCloud, MessageSquare, ArrowLeft, Send,
  FileText, X, Paperclip, Plus, User, PanelLeftClose, PanelLeftOpen, LogOut, Trash2,
  Hash, Lock, Users,
} from "lucide-react";
import { useRagChat, type ChatMessage } from "@/hooks/useRagChat";
import { useUploadDocuments, UPLOAD_ACCEPT } from "@/hooks/useUploadDocuments";
import { logout } from "@/actions/auth";
import type { DocumentRow } from "@/types/rag";
import DocPreview from "@/components/birbal/DocPreview";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

/* ── Glass style helpers ── */
const frost = (alpha = 0.08, blur = 24) => ({
  background: `rgba(255,255,255,${alpha})`,
  border: "1px solid rgba(255,255,255,0.14)",
  backdropFilter: `blur(${blur}px) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
} as React.CSSProperties);

const WELCOME = "Hello! I am Birbal. Upload a document — PDF, image, Excel, or text — and ask me anything about its contents.";
const WELCOME_WORKSPACE = "I have loaded your Community Workspace files. How can I help you analyze them today?";

const ACTIVE = new Set(["pending_upload", "queued", "processing"]);
const INDEX_TIMEOUT_MS = 4 * 60 * 1000;

interface ConversationSummary { id: string; title: string; updated_at: string }
interface WorkspaceSummary { id: string; name: string; role: "owner" | "member" | "viewer" }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ height: "100dvh", background: "#000" }} />}>
      <ChatView />
    </Suspense>
  );
}

function ChatView() {
  const router = useRouter();
  const workspaceId = useSearchParams().get("workspace");
  const isWorkspace = !!workspaceId;
  const scopeQs = workspaceId ? `?workspaceId=${workspaceId}` : "";
  const queryClient = useQueryClient();

  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Phones get the sidebar as a slide-in drawer instead of main's hide-below-720px.
  const [isMobile, setIsMobile] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // A question waiting on its attachments to finish indexing.
  const [pending, setPending] = useState<{ text: string; names: string[] } | null>(null);
  const [openSource, setOpenSource] = useState<{ msgId: string; marker: number } | null>(null);
  const [preview, setPreview] = useState<{ id: string; page?: number | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useRagChat();
  const { messages, isStreaming, send, resetConversation, loadConversation, appendLocal, conversationId } = chat;
  const upload = useUploadDocuments(workspaceId ?? undefined);
  const busy = isStreaming || !!pending;

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => getJson<WorkspaceSummary[]>("/api/workspaces"),
  });
  const community = workspaces.find((w) => w.id === workspaceId);
  const canUpload = !isWorkspace || community?.role !== "viewer";

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () => getJson<ConversationSummary[]>(`/api/rag/conversations${scopeQs}`),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () => getJson<DocumentRow[]>(`/api/documents${scopeQs}`),
    refetchInterval: (q) => ((q.state.data ?? []).some((d) => ACTIVE.has(d.status)) ? 1500 : false),
  });

  // A thread belongs to the scope it was started in.
  useEffect(() => {
    resetConversation();
  }, [workspaceId, resetConversation]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => { setIsMobile(mq.matches); if (!mq.matches) setMobileNav(false); };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (canUpload) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (canUpload && e.dataTransfer.files.length > 0)
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length)
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = "";
  };
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  /** Uploads, then waits until every file is indexed (or failed) so the question can actually use them. */
  const uploadAndIndex = async (toUpload: File[]) => {
    const { results } = await upload.mutateAsync(toUpload);
    const ids = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.documentId as string] : []));
    const deadline = Date.now() + INDEX_TIMEOUT_MS;
    let rows: DocumentRow[] = [];
    while (ids.length > 0 && Date.now() < deadline) {
      rows = (await getJson<DocumentRow[]>(`/api/documents${scopeQs}`)).filter((d) => ids.includes(d.id));
      if (rows.length === ids.length && rows.every((d) => !ACTIVE.has(d.status))) break;
      await sleep(1500);
    }
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    const failed = rows.filter((d) => d.status === "failed").map((d) => d.title);
    const ready = rows.filter((d) => d.status === "ready").map((d) => d.title);
    return { ready, failed, timedOut: rows.some((d) => ACTIVE.has(d.status)) };
  };

  const handleSend = async () => {
    if (busy || (!input.trim() && files.length === 0)) return;
    const text = input.trim();
    const attached = files;
    const names = attached.map(f => f.name);
    setInput("");
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (attached.length === 0) {
      void send(text, undefined, workspaceId);
      return;
    }

    setPending({ text, names });
    let outcome: Awaited<ReturnType<typeof uploadAndIndex>>;
    try {
      outcome = await uploadAndIndex(attached);
    } catch (err) {
      setPending(null);
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      return;
    }
    setPending(null);
    if (outcome.failed.length > 0) toast.error(`Couldn't read: ${outcome.failed.join(", ")}`);
    if (outcome.timedOut) toast.info("Still indexing — answers will include those files once they're ready.");

    if (text) {
      void send(text, undefined, workspaceId, names);
    } else {
      const now = Date.now();
      appendLocal([
        { id: `lu-${now}`, role: "user", text: "", attachments: names, sources: [], grounding: null, streaming: false, stage: null },
        {
          id: `la-${now}`, role: "assistant", sources: [], grounding: null, streaming: false, stage: null,
          text: outcome.ready.length > 0
            ? `I've read ${outcome.ready.join(", ")}. Ask me anything about ${outcome.ready.length === 1 ? "it" : "them"}.`
            : "I couldn't read those files yet. Try again in a moment.",
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const startNewChat = () => {
    if (busy) return;
    setMobileNav(false);
    resetConversation();
    setFiles([]); setInput("");
  };

  const loadSession = async (id: string) => {
    setMobileNav(false);
    if (busy || id === conversationId) return;
    try {
      await loadConversation(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load that chat.");
    }
  };

  const deleteDocument = async (doc: DocumentRow) => {
    if (!window.confirm(`Delete "${doc.title}"? It will no longer be used for answers.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) toast.error((await res.json().catch(() => null))?.error ?? "Delete failed.");
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const welcome: ChatMessage = {
    id: "welcome", role: "assistant", text: isWorkspace ? WELCOME_WORKSPACE : WELCOME,
    sources: [], grounding: null, streaming: false, stage: null,
  };
  const shown = [welcome, ...messages];
  const lastMsg = messages[messages.length - 1];
  const isThinking = !!pending || (!!lastMsg && lastMsg.role === "assistant" && lastMsg.streaming && !lastMsg.text);

  return (
    <div
      style={{ position: "relative", height: "100dvh", overflow: "hidden", background: "#000", display: "flex" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Video background */}
      <video
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }}
        autoPlay muted loop playsInline
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      {/* Scrim */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 0, pointerEvents: "none" }} />

      {/* ── Drag overlay ── */}
      {isDragging && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            ...frost(0.1, 28),
            borderRadius: 28, padding: "48px 64px",
            textAlign: "center",
            border: "2px dashed rgba(255,255,255,0.25)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}>
            <UploadCloud size={52} color="white" style={{ margin: "0 auto" }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, color: "#fff" }}>Drop documents here</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>PDF, Images, Excel, Word, CSV</p>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        ...frost(0.07, 24),
        width: isSidebarOpen ? 234 : 0,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        margin: isSidebarOpen ? "12px 0 12px 12px" : "12px 0",
        borderRadius: 22,
        boxShadow: isSidebarOpen ? "0 8px 32px rgba(0,0,0,0.35)" : "none",
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1), margin 0.28s cubic-bezier(0.4,0,0.2,1), box-shadow 0.28s ease",
        opacity: isSidebarOpen ? 1 : 0,
      }}
        className={`chat-sidebar${mobileNav ? " open" : ""}`}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "#fff",
            display: "grid", placeItems: "center", color: "#000", flexShrink: 0,
          }}>
            <FileText size={14} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "-0.03em", color: "#fff" }}>
            Birbal
          </span>
        </div>

        <SidebarLink href={isWorkspace ? "/workspace" : "/"}>
          <ArrowLeft size={13} /> {isWorkspace ? "Back to Communities" : "Back to Home"}
        </SidebarLink>

        {/* New chat */}
        <button
          onClick={startNewChat}
          style={{
            ...frost(0.06, 12),
            margin: "8px 12px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, padding: "10px",
            borderRadius: 14, color: "#fff", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        >
          <Plus size={14} /> New Chat
        </button>

        {/* Spaces: personal corpus + every community you belong to */}
        <SectionLabel>Spaces</SectionLabel>
        <div style={{ maxHeight: "30%", overflowY: "auto", padding: "0 8px", flexShrink: 0 }}>
          <SidebarItem active={!isWorkspace} onClick={() => { if (busy) return; setMobileNav(false); router.push("/chat"); }}>
            <Lock size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
            <span>Personal</span>
          </SidebarItem>
          {workspaces.map((w) => (
            <SidebarItem key={w.id} active={workspaceId === w.id} onClick={() => { if (busy) return; setMobileNav(false); router.push(`/chat?workspace=${w.id}`); }}>
              <Hash size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</span>
            </SidebarItem>
          ))}
          <SidebarLink href="/workspace">
            <Users size={12} /> {workspaces.length > 0 ? "Manage communities" : "Create or join a community"}
          </SidebarLink>
        </div>

        {/* History */}
        <SectionLabel>Recent</SectionLabel>
        <div style={{ flex: 1, minHeight: 60, overflowY: "auto", padding: "0 8px" }}>
          {conversations.length === 0 && (
            <p style={{ padding: "10px 8px", fontSize: 12, color: "var(--muted)", textAlign: "center", opacity: 0.7 }}>
              No recent chats
            </p>
          )}
          {conversations.map((session) => (
            <SidebarItem key={session.id} active={conversationId === session.id} onClick={() => loadSession(session.id)}>
              <MessageSquare size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.title}</span>
            </SidebarItem>
          ))}
        </div>

        {/* Documents in this scope */}
        <SectionLabel>{isWorkspace ? "Community files" : "Your documents"}</SectionLabel>
        <div style={{ maxHeight: "32%", overflowY: "auto", padding: "0 8px 6px" }}>
          {documents.length === 0 && (
            <p style={{ padding: "10px 8px", fontSize: 12, color: "var(--muted)", textAlign: "center", opacity: 0.7 }}>
              {canUpload ? "Attach or drop files to start" : "No files yet"}
            </p>
          )}
          {documents.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} onOpen={() => { setMobileNav(false); setPreview({ id: doc.id }); }} onDelete={() => deleteDocument(doc)} />
          ))}
        </div>

        {/* Sign out */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 8, flexShrink: 0 }}>
          <form action={logout}>
            <SidebarItem type="submit">
              <LogOut size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span>Sign out</span>
            </SidebarItem>
          </form>
        </div>
      </aside>
      {mobileNav && <div className="chat-backdrop" onClick={() => setMobileNav(false)} />}

      {/* ── Main chat ── */}
      <div className="chat-main" style={{
        ...frost(0.06, 20),
        flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
        margin: "12px", borderRadius: 22,
        boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
        position: "relative", zIndex: 1,
        overflow: "hidden",
      }}>
        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
          backdropFilter: "blur(16px)",
        }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => (isMobile ? setMobileNav(o => !o) : setIsSidebarOpen(o => !o))}
            title={(isMobile ? mobileNav : isSidebarOpen) ? "Close sidebar" : "Open sidebar"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center",
              padding: 6, borderRadius: 8, transition: "color 0.2s, background 0.2s", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "none"; }}
          >
            {(isMobile ? mobileNav : isSidebarOpen) ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: "#000" }}>
            <FileText size={13} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.03em", color: "#fff" }}>
            Birbal
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
            {isWorkspace && (
              <span className="chat-badge" style={{
                background: "rgba(255,255,255,0.1)", color: "#fff",
                padding: "4px 8px", borderRadius: 4, marginRight: 8,
              }}>
                {community ? community.name : "Community Workspace"}
              </span>
            )}
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
              animation: "pulse-status 2s ease-in-out infinite", display: "inline-block",
            }} />
            Active
          </div>
        </header>

        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {shown.map((msg) =>
            msg.role === "assistant" && msg.streaming && !msg.text ? null : (
              <MessageRow
                key={msg.id}
                msg={msg}
                openMarker={openSource?.msgId === msg.id ? openSource.marker : null}
                onToggleSource={(marker) =>
                  setOpenSource((cur) => (cur?.msgId === msg.id && cur.marker === marker ? null : { msgId: msg.id, marker }))
                }
                onOpenDocument={(id, page) => setPreview({ id, page })}
              />
            )
          )}

          {pending && (
            <MessageRow
              msg={{ id: "pending", role: "user", text: pending.text, attachments: pending.names, sources: [], grounding: null, streaming: false, stage: null }}
              openMarker={null}
              onToggleSource={() => {}}
              onOpenDocument={() => {}}
            />
          )}

          {/* Thinking */}
          {isThinking && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", color: "#000", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                <FileText size={13} />
              </div>
              <div style={{
                ...frost(0.09, 16),
                borderRadius: "18px 18px 18px 4px",
                padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "rgba(255,255,255,0.5)",
                    display: "inline-block",
                    animation: `thinking-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="chat-input-area" style={{ padding: "14px 18px 18px", flexShrink: 0 }}>
          {/* File pills */}
          {files.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {files.map((f, i) => (
                <div key={i} style={{
                  ...frost(0.07, 10),
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--muted)",
                }}>
                  <Paperclip size={11} />
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input box */}
          <div style={{
            ...frost(0.08, 20),
            display: "flex", alignItems: "flex-end", gap: 8,
            borderRadius: 20, padding: 8,
            maxWidth: 820, margin: "0 auto",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            transition: "border-color 0.2s",
          }}>
            {/* Upload */}
            {canUpload && (
              <label style={{
                padding: 10, borderRadius: 10,
                background: "transparent", cursor: "pointer",
                color: "var(--muted)", display: "flex", alignItems: "center",
                transition: "background 0.15s, color 0.15s", flexShrink: 0,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
                title="Attach files"
              >
                <UploadCloud size={18} />
                <input
                  type="file" multiple style={{ display: "none" }}
                  onChange={handleFileChange}
                  accept={UPLOAD_ACCEPT}
                />
              </label>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="chat-textarea"
              placeholder={
                isMobile
                  ? "Ask about your documents…"
                  : canUpload ? "Ask anything about your documents… or drop files here" : "Ask anything about this community's documents…"
              }
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", color: "#fff", fontFamily: "var(--font-sans)",
                fontSize: 14, lineHeight: 1.6, padding: "10px 8px",
                maxHeight: 160, overflowY: "auto", minHeight: 44,
              }}
            />

            <button
              onClick={() => void handleSend()}
              disabled={busy || (!input.trim() && files.length === 0)}
              style={{
                width: 38, height: 38, background: "#fff", color: "#111",
                border: "none", borderRadius: 10, display: "grid",
                placeItems: "center", cursor: "pointer", flexShrink: 0,
                transition: "background 0.15s, transform 0.15s",
                opacity: (busy || (!input.trim() && files.length === 0)) ? 0.25 : 1,
                boxShadow: "0 2px 10px rgba(255,255,255,0.15)",
              }}
              onMouseEnter={e => {
                if (!busy && (input.trim() || files.length)) {
                  e.currentTarget.style.transform = "scale(1.08)";
                }
              }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              <Send size={16} />
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 10 }}>
            Birbal may make mistakes. Verify important information.
          </p>
        </div>
      </div>

      {preview && <DocPreview documentId={preview.id} page={preview.page} onClose={() => setPreview(null)} />}

      {/* Inline keyframes */}
      <style>{`
        @keyframes pulse-status {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes thinking-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Sidebar pieces (main's history-item styling) ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
      {children}
    </p>
  );
}

function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 16px", color: "var(--muted)", fontSize: 12,
      textDecoration: "none", transition: "color 0.2s", flexShrink: 0,
    }}
      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
    >
      {children}
    </Link>
  );
}

function SidebarItem({
  active = false, onClick, type = "button", children,
}: { active?: boolean; onClick?: () => void; type?: "button" | "submit"; children: React.ReactNode }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "8px 10px", borderRadius: 10,
        background: active ? "rgba(255,255,255,0.10)" : "transparent",
        border: active ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
        color: active ? "#fff" : "var(--muted)",
        fontSize: 13, cursor: "pointer",
        textAlign: "left", overflow: "hidden", transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; } }}
    >
      {children}
    </button>
  );
}

function docStatus(doc: DocumentRow) {
  if (doc.status === "ready") return { text: `Ready · ${doc.chunk_count} chunk${doc.chunk_count === 1 ? "" : "s"}`, color: "rgba(255,255,255,0.4)" };
  if (doc.status === "failed") return { text: "Failed to read", color: "#f87171" };
  return { text: `Reading… ${doc.progress_pct ?? 0}%`, color: "#fbbf24" };
}

function DocumentItem({ doc, onOpen, onDelete }: { doc: DocumentRow; onOpen: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  const status = docStatus(doc);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      title={doc.status === "failed" ? doc.error ?? undefined : `Preview ${doc.title}`}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, cursor: "pointer",
        background: hover ? "rgba(255,255,255,0.07)" : "transparent", transition: "background 0.15s",
      }}
    >
      <FileText size={12} style={{ opacity: 0.5, flexShrink: 0, color: "#fff" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: hover ? "#fff" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {doc.title}
        </div>
        <div style={{ fontSize: 10.5, color: status.color, marginTop: 1 }}>{status.text}</div>
      </div>
      {hover && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", padding: 2 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

/* ── Messages (main's bubble styling) ── */

const CITE = "#cite-";
const linkifyMarkers = (text: string) => text.replace(/\[(\d+)\]/g, (_, n) => `[${n}](${CITE}${n})`);

const VERDICT_NOTE: Record<string, { text: string; color: string }> = {
  partial: { text: "Only partly supported by your documents.", color: "#fbbf24" },
  conflicting_evidence: { text: "Your documents disagree on this. Both sides are cited.", color: "#fbbf24" },
};

function MessageRow({
  msg, openMarker, onToggleSource, onOpenDocument,
}: {
  msg: ChatMessage;
  openMarker: number | null;
  onToggleSource: (marker: number) => void;
  onOpenDocument: (documentId: string, page: number | null) => void;
}) {
  const isUser = msg.role === "user";
  const nearMiss = msg.grounding?.verdict === "insufficient_evidence";
  const note = msg.grounding ? VERDICT_NOTE[msg.grounding.verdict] : undefined;
  const openSrc = msg.sources.find((s) => s.marker === openMarker);

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row" }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        marginTop: 2, display: "grid", placeItems: "center",
        ...(isUser
          ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff" }
          : { background: "#fff", color: "#000" }),
      }}>
        {isUser ? <User size={13} /> : <FileText size={13} />}
      </div>
      {/* Bubble */}
      <div className="chat-bubble" style={{
        maxWidth: "68%", padding: "12px 18px", fontSize: 16, lineHeight: 1.7,
        ...(isUser
          ? {
            background: "#fff",
            color: "#111",
            fontWeight: 500,
            borderRadius: "18px 18px 4px 18px",
            border: "none",
            boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
          }
          : {
            ...frost(0.09, 16),
            borderRadius: "18px 18px 18px 4px",
            color: "rgba(255,255,255,0.92)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
          }),
      }}>
        {isUser ? (
          <>
            {msg.text && <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>}
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ fontSize: 13, opacity: 0.6, marginTop: msg.text ? 4 : 0 }}>[Attached: {msg.attachments.join(", ")}]</div>
            )}
          </>
        ) : (
          <>
            <div className="answer-md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) =>
                    href?.startsWith(CITE) ? (
                      <button type="button" className="cite-pill" onClick={() => onToggleSource(Number(href.slice(CITE.length)))}>
                        {href.slice(CITE.length)}
                      </button>
                    ) : (
                      <a href={href} target="_blank" rel="noreferrer noopener" style={{ color: "#fff", textDecoration: "underline" }}>{children}</a>
                    ),
                }}
              >
                {linkifyMarkers(msg.text)}
              </ReactMarkdown>
            </div>

            {note && <div style={{ fontSize: 12.5, color: note.color, marginTop: 10 }}>{note.text}</div>}

            {msg.sources.length > 0 && (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                  {nearMiss ? "Closest matches (not used)" : "Sources"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {msg.sources.map((s) => (
                    <button
                      key={s.marker}
                      type="button"
                      onClick={() => onToggleSource(s.marker)}
                      style={{
                        ...frost(openMarker === s.marker ? 0.16 : 0.06, 10),
                        display: "flex", alignItems: "center", gap: 6, maxWidth: "100%",
                        borderRadius: 8, padding: "4px 9px", fontSize: 12, color: "#fff", cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{s.marker}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, color: "rgba(255,255,255,0.75)" }}>{s.documentTitle}</span>
                      {s.pageFrom != null && <span style={{ color: "rgba(255,255,255,0.45)" }}>p.{s.pageFrom}{s.pageTo && s.pageTo !== s.pageFrom ? `–${s.pageTo}` : ""}</span>}
                    </button>
                  ))}
                </div>
                {openSrc && (
                  <div style={{ ...frost(0.05, 10), borderRadius: 10, padding: "9px 12px", marginTop: 8, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.8)" }}>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                      {openSrc.documentTitle}
                      {openSrc.pageFrom != null ? ` · page ${openSrc.pageFrom}` : ""}
                      {openSrc.sectionPath.length > 0 ? ` · ${openSrc.sectionPath.join(" › ")}` : ""}
                    </div>
                    “{openSrc.snippet}”
                    {openSrc.documentId && (
                      <button
                        type="button"
                        onClick={() => onOpenDocument(openSrc.documentId, openSrc.pageFrom)}
                        style={{ display: "block", marginTop: 8, background: "none", border: "none", padding: 0, color: "#fff", fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}
                      >
                        Open document{openSrc.pageFrom != null ? ` at page ${openSrc.pageFrom}` : ""} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
