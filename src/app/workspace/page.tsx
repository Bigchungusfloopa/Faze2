"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, FolderOpen, UploadCloud, Shield,
  MessageSquare, UserPlus, FileText, Trash2,
  Plus, ArrowLeft, Hash, Check, LogIn, LogOut,
} from "lucide-react";
import { useUploadDocuments, UPLOAD_ACCEPT } from "@/hooks/useUploadDocuments";
import type { DocumentRow } from "@/types/rag";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

const COMMUNITY_THEMES = [
  { accent: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.35)",  tag: "#a78bfa", label: "Violet"  },
  { accent: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.35)",  tag: "#60a5fa", label: "Blue"    },
  { accent: "rgba(16,185,129,0.18)",  border: "rgba(16,185,129,0.35)",  tag: "#34d399", label: "Emerald" },
  { accent: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.35)",  tag: "#fbbf24", label: "Amber"   },
  { accent: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.35)",   tag: "#f87171", label: "Rose"    },
  { accent: "rgba(6,182,212,0.18)",   border: "rgba(6,182,212,0.35)",   tag: "#22d3ee", label: "Cyan"    },
];

type DbRole = "owner" | "member" | "viewer";
const ROLE_LABEL: Record<DbRole, "Admin" | "Editor" | "Viewer"> = { owner: "Admin", member: "Editor", viewer: "Viewer" };

interface Community {
  id: string; name: string; theme_idx: number; role: DbRole;
  member_count: number; file_count: number; member_names: string[];
}
interface Member { user_id: string; name: string; email: string; role: DbRole }

const frost = (alpha = 0.07, blur = 24, border = "rgba(255,255,255,0.12)") =>
  ({
    background: `rgba(255,255,255,${alpha})`,
    border: `1px solid ${border}`,
    backdropFilter: `blur(${blur}px) saturate(180%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
  } as React.CSSProperties);

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
  padding: "10px 14px", color: "#fff", fontSize: 15, outline: "none", width: "100%",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  return (await res.json()).data as T;
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Something went wrong.");
  return json;
}

const ACTIVE = new Set(["pending_upload", "queued", "processing"]);

function formatSize(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function WorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [tab, setTab] = useState<"files" | "members">("files");
  const [form, setForm] = useState<"create" | "join" | null>(null);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newTheme, setNewTheme] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => getJson<Community[]>("/api/workspaces"),
  });

  const activeCommunity = communities.find((c) => c.id === active) ?? null;
  const theme = activeCommunity ? COMMUNITY_THEMES[activeCommunity.theme_idx] ?? COMMUNITY_THEMES[0] : null;
  const isAdmin = activeCommunity?.role === "owner";
  const canUpload = activeCommunity?.role === "owner" || activeCommunity?.role === "member";

  const { data: files = [] } = useQuery({
    queryKey: ["documents", active],
    queryFn: () => getJson<DocumentRow[]>(`/api/documents?workspaceId=${active}`),
    enabled: !!active,
    refetchInterval: (q) => ((q.state.data ?? []).some((d) => ACTIVE.has(d.status)) ? 1500 : false),
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", active],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${active}/members`);
      if (!res.ok) throw new Error("Could not load members.");
      return (await res.json()) as { data: Member[]; currentUserId: string };
    },
    enabled: !!active,
  });
  const members = membersData?.data ?? [];
  const me = membersData?.currentUserId;

  const upload = useUploadDocuments(active ?? undefined);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    queryClient.invalidateQueries({ queryKey: ["members", active] });
    queryClient.invalidateQueries({ queryKey: ["documents", active] });
  };

  const closeForm = () => { setForm(null); setNewName(""); setNewPassword(""); };

  const submitForm = async () => {
    if (!newName.trim() || !newPassword || submitting) return;
    setSubmitting(true);
    try {
      const { data } = form === "create"
        ? await send("/api/workspaces", "POST", { name: newName.trim(), password: newPassword, themeIdx: newTheme })
        : await send("/api/workspaces/join", "POST", { name: newName.trim(), password: newPassword });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(form === "create" ? `Created "${data.name}"` : `Joined "${data.name}"`);
      closeForm();
      setActive(data.id);
      setTab("files");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteOrLeave = async (c: Community) => {
    const admin = c.role === "owner";
    const question = admin
      ? `Delete "${c.name}" for everyone? All of its files will be removed.`
      : `Leave "${c.name}"?`;
    if (!window.confirm(question)) return;
    try {
      if (admin) await send(`/api/workspaces/${c.id}`, "DELETE");
      else await send(`/api/workspaces/${c.id}/members/${me ?? (await myId(c.id))}`, "DELETE");
      if (active === c.id) setActive(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(admin ? `Deleted "${c.name}"` : `Left "${c.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!active || !e.target.files?.length) return;
    upload.mutate(Array.from(e.target.files), { onSettled: refresh });
    e.target.value = "";
  };

  const removeFile = async (doc: DocumentRow) => {
    if (!window.confirm(`Delete "${doc.title}" from this community?`)) return;
    try {
      await send(`/api/documents/${doc.id}`, "DELETE");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const updateRole = async (userId: string, role: DbRole) => {
    try {
      await send(`/api/workspaces/${active}/members/${userId}`, "PATCH", { role });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change role.");
    }
  };

  const removeMember = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name} from this community?`)) return;
    try {
      await send(`/api/workspaces/${active}/members/${m.user_id}`, "DELETE");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden", background: "#000", display: "flex", flexDirection: "column" }}>
      <video style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }} autoPlay muted loop playsInline>
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 0, pointerEvents: "none" }} />

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: "#000" }}><FileText size={16} /></div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", letterSpacing: "-0.02em" }}>Birbal</span>
        </Link>
        <nav style={{ display: "flex", gap: 4, ...frost(0.05, 12), padding: 6, borderRadius: 999 }}>
          <Link href="/"     style={{ padding: "8px 16px", color: "#ccc", textDecoration: "none", fontSize: 14, borderRadius: 999 }}>Home</Link>
          <div               style={{ padding: "8px 16px", color: "#fff", fontSize: 14, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>Workspace</div>
          <Link href="/chat" style={{ padding: "8px 16px", color: "#ccc", textDecoration: "none", fontSize: 14, borderRadius: 999 }}>Chat</Link>
        </nav>
      </header>

      <main style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px 48px" }}>

        {/* ====== LIST VIEW ====== */}
        {!activeCommunity && (
          <div style={{ width: "100%", maxWidth: 900 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "#fff", margin: 0, letterSpacing: "-0.03em" }}>Communities</h1>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Create and manage shared workspaces for your teams.</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setForm("join")} style={{ ...frost(0.06, 12), display: "flex", alignItems: "center", gap: 8, color: "#fff", padding: "10px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "transform 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <LogIn size={16} /> Join Community
                </button>
                <button onClick={() => setForm("create")} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#000", border: "none", padding: "10px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "transform 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <Plus size={16} /> New Community
                </button>
              </div>
            </div>

            {form && (
              <div style={{ ...frost(0.06, 28, "rgba(255,255,255,0.15)"), borderRadius: 20, padding: "24px 28px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>{form === "create" ? "New Community" : "Join a Community"}</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} placeholder="Community name…" autoFocus style={inputStyle} />
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} type="password"
                  placeholder={form === "create" ? "Set a password (share it with people you invite)…" : "Community password…"} style={inputStyle} />
                {form === "create" && (
                  <div>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>Choose a colour theme</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      {COMMUNITY_THEMES.map((t, i) => (
                        <button key={i} onClick={() => setNewTheme(i)} title={t.label} style={{ width: 32, height: 32, borderRadius: "50%", border: newTheme === i ? `2px solid ${t.tag}` : "2px solid transparent", background: t.accent, cursor: "pointer", outline: "none", display: "grid", placeItems: "center", transform: newTheme === i ? "scale(1.2)" : "scale(1)", transition: "transform 0.15s" }}>
                          {newTheme === i && <Check size={14} color={t.tag} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={submitForm} disabled={submitting} style={{ flex: 1, background: "#fff", color: "#000", border: "none", padding: "10px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? "…" : form === "create" ? "Create" : "Join"}
                  </button>
                  <button onClick={closeForm} style={{ ...frost(0.05, 10), color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {communities.map(c => {
                const t = COMMUNITY_THEMES[c.theme_idx] ?? COMMUNITY_THEMES[0];
                const admin = c.role === "owner";
                return (
                  <div key={c.id} onClick={() => { setActive(c.id); setTab("files"); setShowInvite(false); }}
                    style={{ background: t.accent, border: `1px solid ${t.border}`, backdropFilter: "blur(28px) saturate(200%)", WebkitBackdropFilter: "blur(28px) saturate(200%)", borderRadius: 20, padding: "24px 22px", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)"; }}
                  >
                    <button onClick={e => { e.stopPropagation(); void deleteOrLeave(c); }} title={admin ? "Delete community" : "Leave community"} style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.2)", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: "rgba(255,255,255,0.4)", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                    >{admin ? <Trash2 size={13} /> : <LogOut size={13} />}</button>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: t.border, display: "grid", placeItems: "center" }}><Hash size={20} color={t.tag} /></div>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                        <div style={{ color: t.tag, fontSize: 11, fontWeight: 500, marginTop: 2 }}>{t.label} · {ROLE_LABEL[c.role]}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><FileText size={13} /> {c.file_count} file{Number(c.file_count) !== 1 ? "s" : ""}</span>
                      <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><Users size={13} /> {c.member_count} member{Number(c.member_count) !== 1 ? "s" : ""}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex" }}>
                        {c.member_names.map((name, i) => (
                          <div key={i} title={name} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(0,0,0,0.4)", display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 600, marginLeft: i === 0 ? 0 : -8, zIndex: i }}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: t.tag, fontWeight: 500 }}>Open →</span>
                    </div>
                  </div>
                );
              })}
              {!isLoading && communities.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", padding: "48px 0", fontSize: 15 }}>No communities yet. Create your first one!</div>
              )}
            </div>
          </div>
        )}

        {/* ====== DETAIL VIEW ====== */}
        {activeCommunity && theme && (
          <div style={{ width: "100%", maxWidth: 800 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <button onClick={() => setActive(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 10, padding: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                ><ArrowLeft size={14} /> All Communities</button>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: theme.border, display: "grid", placeItems: "center" }}><Hash size={22} color={theme.tag} /></div>
                  <div>
                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "#fff", margin: 0 }}>{activeCommunity.name}</h1>
                    <span style={{ fontSize: 12, color: theme.tag, fontWeight: 500 }}>{theme.label} community · You are {ROLE_LABEL[activeCommunity.role]}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => router.push(`/chat?workspace=${activeCommunity.id}`)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#000", border: "none", padding: "10px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "transform 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              ><MessageSquare size={16} /> Chat with Community</button>
            </div>

            <div style={{ background: theme.accent, border: `1px solid ${theme.border}`, backdropFilter: "blur(32px) saturate(200%)", WebkitBackdropFilter: "blur(32px) saturate(200%)", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", gap: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${theme.border}`, paddingBottom: 14 }}>
                {(["files", "members"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, background: tab === t ? theme.border : "transparent", color: tab === t ? "#fff" : "rgba(255,255,255,0.45)", transition: "background 0.2s, color 0.2s" }}>
                    {t === "files" ? <FolderOpen size={15} /> : <Users size={15} />}
                    {t === "files" ? `Files (${files.length})` : `Members (${members.length || activeCommunity.member_count})`}
                  </button>
                ))}
              </div>

              {tab === "files" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.25s ease" }}>
                  {canUpload ? (
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px", borderRadius: 14, border: `1px dashed ${theme.border}`, cursor: "pointer", background: "rgba(0,0,0,0.15)", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.15)"}
                    >
                      <UploadCloud size={28} color={theme.tag} style={{ marginBottom: 10 }} />
                      <span style={{ color: "#fff", fontWeight: 500, fontSize: 14 }}>{upload.isPending ? "Uploading…" : "Upload Files"}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>PDF, DOCX, CSV, XLSX, PPTX…</span>
                      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} style={{ display: "none" }} onChange={handleFileUpload} />
                    </label>
                  ) : (
                    <div style={{ padding: "14px", borderRadius: 14, border: `1px dashed ${theme.border}`, background: "rgba(0,0,0,0.15)", color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center" }}>
                      Viewers can read and chat with these files but can&apos;t upload.
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {files.map(f => {
                      const canDelete = isAdmin || f.owner_id === me;
                      const statusText = f.status === "ready" ? null : f.status === "failed" ? "Failed to read" : `Reading… ${f.progress_pct ?? 0}%`;
                      return (
                        <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.18)", border: `1px solid ${theme.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                            <FileText size={17} color={theme.tag} style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#fff", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                                {formatSize(f.size_bytes)} · {formatDate(f.created_at)}
                                {statusText && <span style={{ color: f.status === "failed" ? "#f87171" : theme.tag }}> · {statusText}</span>}
                              </div>
                            </div>
                          </div>
                          {canDelete && (
                            <button onClick={() => removeFile(f)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 6, borderRadius: 6, transition: "color 0.2s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
                            ><Trash2 size={15} /></button>
                          )}
                        </div>
                      );
                    })}
                    {files.length === 0 && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", padding: "20px 0", fontSize: 14 }}>No files yet.</div>}
                  </div>
                </div>
              )}

              {tab === "members" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.25s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Manage access for your community.</span>
                    <button onClick={() => setShowInvite(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: theme.border, color: "#fff", border: "none", padding: "7px 13px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}><UserPlus size={14} /> Invite</button>
                  </div>
                  {showInvite && (
                    <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.25)", border: `1px dashed ${theme.border}`, color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.6 }}>
                      Share the community name <strong style={{ color: "#fff" }}>{activeCommunity.name}</strong> and its password.
                      They open <strong style={{ color: "#fff" }}>Workspace → Join Community</strong> and join as an Editor
                      {isAdmin ? "; you can change their role here afterwards." : "."}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {members.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.18)", border: `1px solid ${theme.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.accent, border: `1px solid ${theme.border}`, display: "grid", placeItems: "center", color: theme.tag, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{m.name.charAt(0).toUpperCase()}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>{m.name}{m.user_id === me ? " (you)" : ""}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ position: "relative" }}>
                            <select value={m.role} disabled={!isAdmin} onChange={e => updateRole(m.user_id, e.target.value as DbRole)} style={{ appearance: "none", background: "rgba(0,0,0,0.3)", border: `1px solid ${theme.border}`, color: "#fff", padding: "6px 28px 6px 12px", borderRadius: 6, fontSize: 13, cursor: isAdmin ? "pointer" : "default", outline: "none", opacity: isAdmin ? 1 : 0.75 }}>
                              <option value="owner">Admin</option>
                              <option value="member">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <Shield size={11} color={theme.tag} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                          </div>
                          {isAdmin && m.user_id !== me && (
                            <button onClick={() => removeMember(m)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 5, borderRadius: 6, transition: "color 0.2s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
                            ><Trash2 size={15} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", padding: "20px 0", fontSize: 14 }}>Loading members…</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}

async function myId(workspaceId: string): Promise<string> {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`);
  return (await res.json()).currentUserId;
}
