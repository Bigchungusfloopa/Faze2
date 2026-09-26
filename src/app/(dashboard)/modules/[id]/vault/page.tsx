"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { Loader2, FolderSync, Download, Trash2, Plus, Image as ImageIcon, Video, Music, FileText, Archive, FileCode, File, Eye, Upload, Tag, X, Folder, Search, ChevronRight, FolderPlus, Settings2, Link2, ExternalLink, PlayCircle, MoreVertical, Check, Pencil, Maximize2, Minimize2, Minus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { motion, useDragControls, useMotionValue } from "framer-motion"
import { useDragAndDrop } from "@/hooks/useDragAndDrop"
import { useVaultWindowStore, type VaultWindow } from "@/lib/stores/useVaultWindowStore"
import {
  createVaultLink,
  shareToModuleVault,
  removeModuleVaultItem,
  updateModuleVaultItem,
  createModuleVaultFolder,
  updateModuleVaultFolder,
  deleteModuleVaultFolder,
} from "@/actions/vault"

function getUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0]
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v")
  } catch { /* ignore */ }
  return null
}

function getYouTubePlaylistId(url: string): string | null {
  try {
    const u = new URL(url)
    return u.searchParams.get("list")
  } catch { return null }
}

function getGoogleDriveInfo(url: string): { type: "file" | "folder"; id: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes("drive.google.com")) return null
    const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return { type: "file", id: fileMatch[1] }
    const folderMatch = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return { type: "folder", id: folderMatch[1] }
    const id = u.searchParams.get("id")
    if (id) return { type: "file", id }
  } catch { /* ignore */ }
  return null
}

function getLinkIcon(url: string) {
  if (!url) return <Link2 className="w-8 h-8 text-[#0057FF]" />
  const lower = url.toLowerCase()
  if (lower.includes("youtube.com") || lower.includes("youtu.be"))
    return <PlayCircle className="w-8 h-8 text-[#FF3B30]" />
  if (lower.includes("drive.google.com"))
    return (
      <svg viewBox="0 0 87.3 78" className="w-8 h-8" aria-label="Google Drive">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 52H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5C.4 48.9 0 50.45 0 52h27.5z" fill="#00ac47" />
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60l5.85 11.5z" fill="#ea4335" />
        <path d="M43.65 25L57.4 0c-1.55 0-3.1.4-4.5 1.2L29.9 0 16.15 25z" fill="#00832d" />
        <path d="M60 52H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.55 0 3.1-.4 4.5-1.2z" fill="#2684fc" />
        <path d="M73.4 26.5L59.65 2.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 60 52h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
      </svg>
    )
  return <Link2 className="w-8 h-8 text-[#0057FF]" />
}

function getLinkBgColor(url: string): string {
  if (!url) return "bg-[#EEF3FF]"
  const lower = url.toLowerCase()
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "bg-[#FFF0F0]"
  if (lower.includes("drive.google.com")) return "bg-[#F0F7FF]"
  return "bg-[#EEF3FF]"
}

const getFileIcon = (mimeType: string = "") => {
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-8 h-8 text-[#0057FF]" />
  if (mimeType.startsWith("video/")) return <Video className="w-8 h-8 text-[#FF3CAC]" />
  if (mimeType.startsWith("audio/")) return <Music className="w-8 h-8 text-[#FFD600]" />
  if (mimeType.includes("pdf")) return <FileText className="w-8 h-8 text-[#FF3B30]" />
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("compressed"))
    return <Archive className="w-8 h-8 text-foreground" />
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("html"))
    return <FileCode className="w-8 h-8 text-[#4285F4]" />
  return <File className="w-8 h-8 text-muted-foreground" />
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 Bytes"
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VaultWindowRenderer({
  win,
  onClose,
  onDownload,
  onFocus,
  onMinimize,
  constraintsRef,
}: {
  win: VaultWindow
  onClose: () => void
  onDownload?: () => void
  onFocus: () => void
  onMinimize: () => void
  constraintsRef: React.RefObject<HTMLDivElement | null>
}) {
  const isImage = win.type === "image"
  const isPdf = win.type === "pdf"
  const isYoutube = win.type === "youtube"
  const isDriveFile = win.type === "drive_file"
  const isDriveFolder = win.type === "drive_folder"

  const [scale, setScale] = useState(1)
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 5))
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25))
  const zoomReset = () => setScale(1)
  const handleWheel = (e: React.WheelEvent) => {
    if (!isImage) return
    e.preventDefault()
    setScale(s => Math.min(Math.max(s - e.deltaY * 0.001, 0.25), 5))
  }

  const dragControls = useDragControls()
  const x = useMotionValue(0)
  const [size, setSize] = useState({ w: 900, h: 600 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startXVal: number } | null>(null)

  const onResizeStart = (e: React.MouseEvent, direction: "se" | "sw") => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startXVal: x.get() }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dw = ev.clientX - resizeRef.current.startX
      const dh = ev.clientY - resizeRef.current.startY
      let newW = resizeRef.current.startW
      const newH = Math.max(320, resizeRef.current.startH + dh)

      if (direction === "se") {
        newW = Math.max(480, resizeRef.current.startW + dw)
      } else {
        newW = Math.max(480, resizeRef.current.startW - dw)
        if (newW > 480) x.set(resizeRef.current.startXVal + dw)
      }

      setSize({ w: newW, h: newH })
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const dialogSize = isFullscreen
    ? { width: "100vw", height: "100vh", borderRadius: 0, border: "none" }
    : { width: size.w, height: size.h }

  return (
    <motion.div
      drag={!isFullscreen}
      dragMomentum={false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraintsRef}
      onMouseDownCapture={onFocus}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{
        opacity: win.isMinimized ? 0 : 1,
        scale: win.isMinimized ? 0.8 : 1,
        y: win.isMinimized ? 20 : 0,
        pointerEvents: win.isMinimized ? "none" : "auto",
      }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.15 }}
      style={{
        x,
        zIndex: win.zIndex,
        position: isFullscreen ? "fixed" : "absolute",
        top: isFullscreen ? 0 : "10%",
        left: isFullscreen ? 0 : "10%",
        ...dialogSize,
        maxWidth: "none",
        transition: isFullscreen ? "all 0.2s ease" : "none",
      }}
      className={`viewer-chrome bg-black border-[3px] border-black p-0 flex flex-col overflow-hidden ${isFullscreen ? "" : "rounded-[2rem] shadow-[8px_8px_0px_#FFD600]"}`}
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between px-5 py-3 border-b-[2px] border-[#222] shrink-0 select-none cursor-move"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="viewer-file-icon w-7 h-7 bg-[#FFD600] rounded-[7px] border-[2px] border-black flex items-center justify-center shrink-0">
            {isImage ? <ImageIcon className="w-3.5 h-3.5 text-foreground" /> :
              isYoutube ? <PlayCircle className="w-3.5 h-3.5 text-foreground" /> :
                isDriveFile || isDriveFolder ? <Link2 className="w-3.5 h-3.5 text-foreground" /> :
                  <FileText className="w-3.5 h-3.5 text-foreground" />}
          </div>
          <span className="font-heading font-bold text-[14px] text-white truncate">{win.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 cursor-default" onMouseDown={e => e.stopPropagation()}>
          {isImage && (
            <div className="flex items-center gap-1 bg-[#1A1A1A] border-[2px] border-[#333] rounded-[0.75rem] px-1 py-1">
              <button onClick={zoomOut} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom out">-</button>
              <button onClick={zoomReset} className="px-2 h-7 rounded-[6px] hover:bg-[#333] font-mono text-[11px] text-[#999] transition-all min-w-[42px] text-center" title="Reset zoom">{Math.round(scale * 100)}%</button>
              <button onClick={zoomIn} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom in">+</button>
            </div>
          )}

          <button onClick={onMinimize} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title="Minimize">
            <Minus className="w-3.5 h-3.5 text-white" />
          </button>
          <button onClick={() => setIsFullscreen(f => !f)} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title={isFullscreen ? "Restore" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
          </button>
          <button onClick={() => window.open(win.url, "_blank", "noopener,noreferrer")} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5 text-white" />
          </button>
          {onDownload && (
            <button onClick={onDownload} className="px-3 py-1.5 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#222] text-white font-heading font-bold text-[12px] flex items-center gap-1.5 transition-all">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#FF3B30] flex items-center justify-center transition-all">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center bg-[#111] relative cursor-default" onWheel={handleWheel} onMouseDown={e => e.stopPropagation()}>
        {isImage && (
          <div className="min-w-full min-h-full flex items-center justify-center p-6" style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={win.url} alt={win.title} draggable={false} className="object-contain rounded-[0.75rem] shadow-[0_0_60px_#0006] transition-transform duration-100 ease-out" style={{ transform: `scale(${scale})`, transformOrigin: "center center" }} />
          </div>
        )}
        {isPdf && <embed src={win.url} type="application/pdf" className="w-full h-full" />}
        {isYoutube && <iframe src={win.url} title={win.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full border-none" />}
        {isDriveFile && <iframe src={win.url} title={win.title} allow="autoplay" className="w-full h-full border-none" />}
        {isDriveFolder && <iframe src={win.url} title={win.title} className="w-full h-full border-none bg-white" />}
      </div>

      {!isFullscreen && (
        <>
          <div onMouseDown={(e) => onResizeStart(e, "sw")} className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize flex items-end justify-start p-1.5 z-50" title="Drag to resize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M1 5L5 9M1 9H1" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div onMouseDown={(e) => onResizeStart(e, "se")} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1.5 z-50" title="Drag to resize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── Rename Folder Modal ─────────────────────────────────────────────────────
function RenameFolderModal({
  isOpen,
  folder,
  communityId,
  onClose,
  onRenamed,
}: {
  isOpen: boolean
  folder: any
  communityId: string
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(folder.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await updateModuleVaultFolder(communityId, folder.id, { name: name.trim() })
      toast.success(`Folder renamed to "${name.trim()}"`)
      onRenamed()
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Failed to rename folder")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-8">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#FFD600] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <Pencil className="w-4 h-4 text-foreground" />
            </div>
            Rename Folder
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">New Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Folder name…" className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]" />
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all">Cancel</button>
            <button type="submit" disabled={isSaving || !name.trim()} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {isSaving ? "Saving…" : "Rename"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rename Item Modal ────────────────────────────────────────────────────────
function RenameItemModal({
  isOpen,
  item,
  communityId,
  onClose,
  onRenamed,
}: {
  isOpen: boolean
  item: any
  communityId: string
  onClose: () => void
  onRenamed: () => void
}) {
  const vi = Array.isArray(item?.vault_items) ? item.vault_items[0] : item?.vault_items
  const file = Array.isArray(vi?.files) ? vi.files[0] : vi?.files
  const isLink = vi?.item_type === "link"
  const currentName = isLink ? (vi?.title ?? "") : (file?.filename ?? "")
  const [name, setName] = useState(currentName)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await updateModuleVaultItem(communityId, item.id, { title: name.trim(), tags: item.tags ?? [], folder_id: item.folder_id ?? null })
      toast.success(`Renamed to "${name.trim()}"`)
      onRenamed()
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Failed to rename")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-8">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#FFD600] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <Pencil className="w-4 h-4 text-foreground" />
            </div>
            Rename {isLink ? "Link" : "File"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">New Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Name…" className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]" />
          </div>
          <DialogFooter className="gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all">Cancel</button>
            <button type="submit" disabled={isSaving || !name.trim()} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {isSaving ? "Saving…" : "Rename"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CommunityVaultPage() {
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [initialFilesToUpload, setInitialFilesToUpload] = useState<File[]>([])
  const handleOpenWindow = useVaultWindowStore((state) => state.openWindow)

  useDragAndDrop((files) => {
    setInitialFilesToUpload(files)
    setIsUploadModalOpen(true)
  })

  // Folders & Search State
  const [searchQuery, setSearchQuery] = useState("")
  const [folderStack, setFolderStack] = useState<{ id: string, name: string }[]>([])
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null

  // Modals state
  const [isCreateFolderModal, setIsCreateFolderModal] = useState(false)
  const [organizeItem, setOrganizeItem] = useState<any>(null)
  const [renamingFolder, setRenamingFolder] = useState<any>(null)
  const [renamingItem, setRenamingItem] = useState<any>(null)
  const [organizeFolder, setOrganizeFolder] = useState<any>(null)

  const { data: community } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${id}`)
      if (!res.ok) throw new Error("Failed to fetch community")
      return res.json()
    },
  })

  // Folders
  const { data: folders = [] } = useQuery({
    queryKey: ["communityVaultFolders", id],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${id}/vault/folders`)
      if (!res.ok) throw new Error("Failed to fetch folders")
      const json = await res.json()
      return json.data
    }
  })

  // Items fetch (all community items)
  const { data: vaultItems = [], isLoading } = useQuery({
    queryKey: ["communityVault", id],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${id}/vault`)
      if (!res.ok) throw new Error("Failed to fetch vault")
      const json = await res.json()
      return json.data
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => removeModuleVaultItem(id, itemId),
    onSuccess: () => {
      toast.success("File removed from Community Vault")
      queryClient.invalidateQueries({ queryKey: ["communityVault", id] })
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  // Bulk actions state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])

  const toggleItem = (id: string) => setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleFolder = (id: string) => setSelectedFolderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const clearSelection = () => { setSelectedItemIds([]); setSelectedFolderIds([]) }

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0 && selectedFolderIds.length === 0) return
    const confirm = window.confirm(`Delete ${selectedItemIds.length} file(s) and ${selectedFolderIds.length} folder(s)?`)
    if (!confirm) return

    const toastId = toast.loading("Deleting selected items...")
    try {
      await Promise.all([
        ...selectedItemIds.map(itemId => removeModuleVaultItem(id, itemId)),
        ...selectedFolderIds.map(folderId => deleteModuleVaultFolder(id, folderId))
      ])
      toast.success("Deleted successfully", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", id] })
      queryClient.invalidateQueries({ queryKey: ["communityVault", id] })
      clearSelection()
    } catch (e: any) {
      toast.error("Failed to delete some items", { id: toastId })
    }
  }

  const handleInternalMove = async (type: 'file' | 'folder', itemId: string, targetFolderId: string | null) => {
    if (type === 'folder' && itemId === targetFolderId) return; // Prevent moving folder into itself

    const toastId = toast.loading("Moving...");
    try {
      if (type === 'file') {
        await updateModuleVaultItem(id, itemId, { folder_id: targetFolderId })
      } else if (type === 'folder') {
        await updateModuleVaultFolder(id, itemId, { parent_id: targetFolderId })
      }
      toast.success("Moved successfully", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["communityVault", id] });
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to move item", { id: toastId });
    }
  }

  const getFileAccessUrl = async (itemId: string, action: 'view' | 'download' = 'view') => {
    setActiveItemId(itemId)
    try {
      const res = await fetch(`/api/communities/${id}/vault/${itemId}/download?action=${action}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to get link")
      return data.url as string
    } finally {
      setActiveItemId(null)
    }
  }

  const handleDownload = async (itemId: string, filename: string, action: 'view' | 'download' = 'download') => {
    try {
      const url = await getFileAccessUrl(itemId, action)
      if (!url) return
      const a = document.createElement("a")
      a.href = url
      a.download = action === "download" ? (filename || "file") : ""
      if (action === "view") a.target = "_blank"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e: any) {
      toast.error(e.message || "Failed to access file")
    }
  }

  const handleFileView = async (itemId: string, filename: string, mimeType: string) => {
    try {
      const url = await getFileAccessUrl(itemId, "view")
      if (!url) return
      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        handleOpenWindow({
          type: mimeType.startsWith("image/") ? "image" : "pdf",
          url,
          title: filename || "File",
        })
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to open viewer")
    }
  }

  const role = community?.membership?.role
  const canPublish = role === 'owner' || role === 'curator' || role === 'peer'
  const canOrganize = role === 'owner' || role === 'curator'

  // Filter Local Data
  const q = searchQuery.toLowerCase()
  const filteredItems = vaultItems.filter((m: any) => {
    // If actively searching, search globally across all folder structures
    if (q) {
      const vi = Array.isArray(m.vault_items) ? m.vault_items[0] : m.vault_items
      const file = Array.isArray(vi?.files) ? vi.files[0] : vi?.files
      const checksName = file?.filename?.toLowerCase().includes(q)
      const checksTags = m.tags?.some((t: string) => t.toLowerCase().includes(q))
      return checksName || checksTags
    }

    // Otherwise strictly show items inside the current folder layer
    return (m.folder_id || null) === (currentFolderId || null)
  })

  // Target folders exclusively tied to the current breadcrumb ID unless searching
  const filteredFolders = folders.filter((f: any) => {
    if (q) return f.name.toLowerCase().includes(q)
    return (f.parent_id || null) === (currentFolderId || null)
  })

  // Add renderItemCard dynamically
  const renderItemCard = (item: any) => {
    const vi = Array.isArray(item.vault_items) ? item.vault_items[0] : item.vault_items;
    const file = Array.isArray(vi?.files) ? vi.files[0] : vi?.files;
    const isLink = vi?.item_type === "link";
    if (!file && !isLink) return null;

    const u = Array.isArray(item.users) ? item.users[0] : item.users;

    const isMe = community?.membership?.user_id === u?.id
    const isOwner = role === 'owner' || role === 'curator'
    const canDelete = isMe || isOwner
    const linkDomain = isLink && vi.url ? getUrlDomain(vi.url) : ""
    const ytVideoId = isLink && vi.url ? getYouTubeVideoId(vi.url) : null
    const ytPlaylistId = isLink && vi.url ? getYouTubePlaylistId(vi.url) : null
    const driveInfo = isLink && vi.url ? getGoogleDriveInfo(vi.url) : null
    // item.title is the community-level rename override; fall back to the original source name
    const displayName = item.title ?? (isLink ? (vi?.title ?? "Untitled Link") : (file?.filename ?? "Unknown File"))

    const handleLinkOpen = () => {
      const sourceUrl = vi.url ?? ""
      const playlistId = getYouTubePlaylistId(sourceUrl)
      const youtubeId = getYouTubeVideoId(sourceUrl)
      if (playlistId || youtubeId) {
        handleOpenWindow({
          type: "youtube",
          url: playlistId
            ? `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1`
            : `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
          title: displayName,
        })
        return
      }

      const googleDriveInfo = getGoogleDriveInfo(sourceUrl)
      if (googleDriveInfo) {
        handleOpenWindow({
          type: googleDriveInfo.type === "folder" ? "drive_folder" : "drive_file",
          url: googleDriveInfo.type === "folder"
            ? `https://drive.google.com/embeddedfolderview?id=${googleDriveInfo.id}#list`
            : `https://drive.google.com/file/d/${googleDriveInfo.id}/preview`,
          title: displayName,
        })
        return
      }

      window.open(sourceUrl, "_blank", "noopener,noreferrer")
    }

    const isItemSelected = selectedItemIds.includes(item.id)
    const selectionMode = selectedItemIds.length > 0 || selectedFolderIds.length > 0

    return (
      <div
        key={item.id}
        draggable={canOrganize || isMe}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/json", JSON.stringify({ type: 'file', id: item.id }));
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => {
          if (selectionMode) { toggleItem(item.id); return }
          if (isLink) handleLinkOpen()
          else handleFileView(item.id, file?.filename ?? "File", file?.mime_type ?? "")
        }}
        className={`group relative border-[2px] rounded-[1.5rem] p-5 transition-all duration-150 flex flex-col h-[230px] ${isItemSelected
          ? "bg-[#FFFBDE] border-[#FFD600] shadow-[4px_4px_0px_#FFD600] ring-[3px] ring-[#FFD60066]"
          : "bg-card border-foreground shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
          } ${isLink || selectionMode ? 'cursor-pointer' : canOrganize || isMe ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div
          onClick={(e) => { e.stopPropagation(); toggleItem(item.id) }}
          className={`absolute top-4 left-4 w-5 h-5 rounded-[6px] border-[2px] border-foreground flex items-center justify-center cursor-pointer transition-all z-10 ${isItemSelected ? 'bg-[#FFD600]' : selectionMode ? 'bg-card opacity-100 hover:bg-background' : 'bg-card opacity-0 group-hover:opacity-100 hover:bg-background'}`}
        >
          {isItemSelected && <Check className="w-3 h-3 text-foreground" strokeWidth={4} />}
        </div>
        <div className="flex justify-between items-start mb-3 pl-8">
          <div className={`w-14 h-14 rounded-[12px] border-[2px] border-foreground flex items-center justify-center shadow-[3px_3px_0px_black] shrink-0 ${isLink ? getLinkBgColor(vi.url ?? "") : "bg-card"}`}>
            {isLink ? getLinkIcon(vi.url ?? "") : getFileIcon(file?.mime_type)}
          </div>

          {/* Actions: View exposed, rest in 3-dot menu */}
          <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {/* View / Open — always exposed */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isLink) handleLinkOpen()
                else handleFileView(item.id, file?.filename ?? "File", file?.mime_type ?? "")
              }}
              disabled={activeItemId === item.id}
              title={isLink ? (ytPlaylistId ? "Watch playlist" : ytVideoId ? "Watch video" : driveInfo ? `Preview Drive ${driveInfo.type}` : "Open link") : "View file"}
              className="w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-[#0057FF] hover:text-white flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
            >
              {isLink ? (ytPlaylistId || ytVideoId ? <PlayCircle className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />) : <Eye className="w-4 h-4" />}
            </button>

            {/* 3-dot dropdown for the rest */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-background flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none outline-none focus:outline-none"
                >
                  <MoreVertical className="w-4 h-4 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-card border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] p-1.5 z-50">
                {!isLink && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleDownload(item.id, file?.filename, 'download') }}
                    disabled={activeItemId === item.id}
                    className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none"
                  >
                    {activeItemId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-[#FFD600]" />} Download
                  </DropdownMenuItem>
                )}
                {canOrganize && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setRenamingItem(item) }}
                      className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none"
                    >
                      <Pencil className="w-4 h-4 text-[#00C853]" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setOrganizeItem(item) }}
                      className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none"
                    >
                      <Settings2 className="w-4 h-4 text-[#0057FF]" /> Organize
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator className="bg-muted my-1" />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.id) }}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium text-[#FF3B30] focus:bg-[#FF3B30] focus:text-white px-2 py-1.5 rounded-[0.5rem] outline-none transition-colors"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <h3 className="font-heading font-bold text-[16px] text-foreground truncate" title={displayName}>
            {displayName}
          </h3>
          <div className="font-mono text-[11px] text-muted-foreground mt-1 flex items-center flex-wrap gap-2">
            {!isLink ? <span>{formatBytes(file?.size_bytes)}</span> : <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />{linkDomain}</span>}
            <span>•</span>
            <span>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>

          {/* Tags Bar */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2 pb-1">
              {item.tags.map((t: string) => (
                <span key={t} className="px-2 py-0.5 rounded-[100px] border-[1.2px] border-foreground bg-background font-mono text-[10px] font-bold text-foreground whitespace-nowrap">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 pt-3 border-t-[2px] border-foreground border-dashed shrink-0">
          <div className="w-6 h-6 rounded-[6px] border-[1.5px] border-foreground overflow-hidden bg-muted shrink-0">
            {u?.profile_pic ? (
              <img src={u.profile_pic} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-foreground">{u?.name?.[0]?.toUpperCase()}</div>
            )}
          </div>
          <span className="font-sans text-[12px] font-medium text-muted-foreground truncate">
            {u?.name}
          </span>
        </div>
      </div>
    )
  }

  if (isLoading && folderStack.length === 0) {
    return (
      <div className="w-full flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative min-h-[70vh]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-[24px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#FF3CAC] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <FolderSync className="w-4 h-4 text-white" />
            </div>
            Community Vault
          </h2>
          <p className="font-sans text-[15px] text-muted-foreground">Shared files, documents, and resources.</p>
        </div>

        {canPublish && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {canOrganize && (
              <button
                onClick={() => setIsCreateFolderModal(true)}
                className="p-2.5 rounded-[1rem] border-[3px] border-foreground bg-background shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all hidden sm:flex items-center justify-center cursor-pointer"
                title="New Folder"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsAddLinkModalOpen(true)}
              className="px-5 py-2.5 rounded-[1rem] border-[3px] border-foreground bg-[#0057FF] shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-heading font-bold text-[14px] text-white flex items-center gap-2 justify-center cursor-pointer"
            >
              <Link2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Link</span>
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-[1rem] border-[3px] border-foreground bg-card shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-heading font-bold text-[14px] text-foreground flex items-center gap-2 justify-center cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
            <button
              onClick={() => setIsPublishModalOpen(true)}
              className="px-5 py-2.5 rounded-[1rem] border-[3px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-heading font-bold text-[14px] text-foreground flex items-center gap-2 justify-center"
            >
              <FolderSync className="w-4 h-4" />
              <span className="hidden sm:inline">Publish from Vault</span>
            </button>
          </div>
        )}
      </div>

      {/* Toolbar: Breadcrumbs + Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted p-3 rounded-[1rem] border-[2px] border-foreground">
        <div className="flex items-center gap-2 overflow-x-auto w-full no-scrollbar px-1">
          <button
            onClick={() => setFolderStack([])}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.opacity = '0.5' }}
            onDragLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.opacity = '1';
              try {
                const dataStr = e.dataTransfer.getData("application/json");
                if (dataStr) {
                  const data = JSON.parse(dataStr);
                  if (data.type && data.id) handleInternalMove(data.type, data.id, null);
                }
              } catch (err) { }
            }}
            className={`font-heading font-bold text-[14px] whitespace-nowrap hover:underline transition-opacity ${folderStack.length === 0 ? 'text-[#0057FF]' : 'text-foreground'}`}
          >
            Root
          </button>
          {folderStack.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 shrink-0">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => setFolderStack(folderStack.slice(0, i + 1))}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.opacity = '0.5' }}
                onDragLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.opacity = '1';
                  try {
                    const dataStr = e.dataTransfer.getData("application/json");
                    if (dataStr) {
                      const data = JSON.parse(dataStr);
                      if (data.type && data.id) handleInternalMove(data.type, data.id, f.id);
                    }
                  } catch (err) { }
                }}
                className={`font-heading font-bold text-[14px] whitespace-nowrap hover:underline transition-opacity ${i === folderStack.length - 1 ? 'text-[#0057FF]' : 'text-foreground'}`}
              >
                {f.name}
              </button>
            </div>
          ))}
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search metadata or tags..."
            className="pl-9 bg-card border-[2px] border-foreground rounded-[0.75rem] shadow-[2px_2px_0px_black] h-10 font-sans text-[14px]"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredFolders.length === 0 && filteredItems.length === 0 && !isLoading ? (
        <div className="bg-background border-[2px] border-foreground rounded-[1.5rem] border-dashed p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-[16px] bg-card border-[2px] border-foreground flex items-center justify-center mb-4 shadow-[4px_4px_0px_black]">
            <FolderSync className="w-8 h-8 text-foreground opacity-50" />
          </div>
          <h3 className="font-heading font-bold text-[20px] text-foreground mb-2">{searchQuery ? 'No results found' : 'Folder is Empty'}</h3>
          <p className="font-sans text-[15px] text-muted-foreground max-w-md mx-auto">{searchQuery ? 'Try matching against different tags or filenames.' : 'Upload natively, publish from personal vaults, or create sub-folders here.'}</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[8px] bg-[#FFD600] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                  <Folder className="w-4 h-4 text-foreground" />
                </div>
                <h3 className="font-heading font-extrabold text-[18px] text-foreground">Folders</h3>
                <div className="px-2.5 py-0.5 rounded-full bg-background border-[2px] border-foreground text-[12px] font-mono font-bold text-foreground">
                  {filteredFolders.length}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredFolders.map((f: any) => (
                  <CommunityFolderCard
                    key={f.id}
                    folder={f}
                    communityId={id}
                    canOrganize={canOrganize}
                    folderStack={folderStack}
                    setFolderStack={setFolderStack}
                    setSearchQuery={setSearchQuery}
                    isSelected={selectedFolderIds.includes(f.id)}
                    onToggle={toggleFolder}
                    selectionMode={selectedItemIds.length > 0 || selectedFolderIds.length > 0}
                    onRename={() => setRenamingFolder(f)}
                    onOrganize={() => setOrganizeFolder(f)}
                    onMoveItemOrFolder={handleInternalMove}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Files & Links Section */}
          {filteredItems.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[8px] bg-[#0057FF] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-heading font-extrabold text-[18px] text-foreground">Files & Links</h3>
                <div className="px-2.5 py-0.5 rounded-full bg-background border-[2px] border-foreground text-[12px] font-mono font-bold text-foreground">
                  {filteredItems.length}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(renderItemCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* All Files View */}
      {!searchQuery && folderStack.length === 0 && vaultItems.length > 0 && (
        <div className="mt-12 pt-8 border-t-[2px] border-foreground border-dashed">
          <h3 className="font-heading font-bold text-[20px] text-foreground mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#00C853] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <File className="w-4 h-4 text-white" />
            </div>
            All Files
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vaultItems.map(renderItemCard)}
          </div>
        </div>
      )}

      <PublishFromVaultModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        communityId={id}
        targetFolderId={currentFolderId}
      />

      <CommunityUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => { setIsUploadModalOpen(false); setInitialFilesToUpload([]) }}
        communityId={id}
        currentFolderId={currentFolderId}
        initialFiles={initialFilesToUpload}
      />

      <CommunityAddLinkModal
        isOpen={isAddLinkModalOpen}
        onClose={() => setIsAddLinkModalOpen(false)}
        communityId={id}
        currentFolderId={currentFolderId}
      />

      <CreateFolderModal
        isOpen={isCreateFolderModal}
        onClose={() => setIsCreateFolderModal(false)}
        communityId={id}
        currentFolderId={currentFolderId}
      />

      {organizeItem && (
        <CommunityOrganizeModal
          isOpen={!!organizeItem}
          onClose={() => setOrganizeItem(null)}
          communityId={id}
          item={organizeItem}
          folders={folders}
        />
      )}

      {renamingFolder && (
        <RenameFolderModal
          isOpen={!!renamingFolder}
          folder={renamingFolder}
          communityId={id}
          onClose={() => setRenamingFolder(null)}
          onRenamed={() => queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", id] })}
        />
      )}

      {renamingItem && (
        <RenameItemModal
          isOpen={!!renamingItem}
          item={renamingItem}
          communityId={id}
          onClose={() => setRenamingItem(null)}
          onRenamed={() => queryClient.invalidateQueries({ queryKey: ["communityVault", id] })}
        />
      )}

      {organizeFolder && (
        <CommunityOrganizeFolderModal
          isOpen={!!organizeFolder}
          onClose={() => setOrganizeFolder(null)}
          communityId={id}
          folder={organizeFolder}
          folders={folders}
        />
      )}

      {/* Bulk Action Bar */}
      {(selectedItemIds.length > 0 || selectedFolderIds.length > 0) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] p-4 px-6 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-200">
          <div className="font-heading font-extrabold text-[16px] text-foreground">
            {selectedItemIds.length + selectedFolderIds.length} Selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearSelection}
              className="font-heading font-bold text-[14px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-[1rem] border-[2px] border-foreground shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all font-heading font-bold text-[14px]"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Community Folder Card ────────────────────────────────────────────────────
function CommunityFolderCard({
  folder,
  communityId,
  canOrganize,
  folderStack,
  setFolderStack,
  setSearchQuery,
  isSelected,
  onToggle,
  selectionMode = false,
  onRename,
  onOrganize,
  onMoveItemOrFolder,
}: {
  folder: any
  communityId: string
  canOrganize: boolean
  folderStack: { id: string; name: string }[]
  setFolderStack: (s: { id: string; name: string }[]) => void
  setSearchQuery: (q: string) => void
  isSelected: boolean
  onToggle: (id: string) => void
  selectionMode?: boolean
  onRename: () => void
  onOrganize: () => void
  onMoveItemOrFolder?: (type: 'file' | 'folder', id: string, targetId: string | null) => void
}) {
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type && data.id && data.id !== folder.id && onMoveItemOrFolder) {
        onMoveItemOrFolder(data.type, data.id, folder.id);
      }
    } catch (err) { }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete folder "${folder.name}"? All files and sub-folders inside will be permanently deleted.`)) return
    setIsDeleting(true)
    const toastId = toast.loading("Deleting folder...")
    try {
      await deleteModuleVaultFolder(communityId, folder.id)
      toast.success("Folder deleted", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", communityId] })
      queryClient.invalidateQueries({ queryKey: ["communityVault", communityId] })
    } catch (err: any) {
      toast.error(err.message || "Failed to delete folder", { id: toastId })
      setIsDeleting(false)
    }
  }

  return (
    <div
      draggable={canOrganize}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type: 'folder', id: folder.id }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (selectionMode) { onToggle(folder.id); return }
        setSearchQuery("")
        setFolderStack([...folderStack, { id: folder.id, name: folder.name }])
      }}
      className={`group relative bg-card border-[2px] rounded-[1.5rem] p-5 transition-all duration-150 flex items-center gap-4 ${isSelected
        ? "border-[#FFD600] shadow-[4px_4px_0px_#FFD600] ring-[3px] ring-[#FFD60066] bg-[#FFFBDE]"
        : isDragOver ? "border-[#0057FF] bg-[#F0F7FF] shadow-[4px_4px_0px_#0057FF] scale-105" : "border-foreground shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
        } ${canOrganize ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(folder.id) }}
        className={`w-5 h-5 rounded-[6px] border-[2px] border-foreground flex items-center justify-center cursor-pointer transition-all shrink-0 ${isSelected ? 'bg-[#FFD600]' : selectionMode ? 'bg-card opacity-100 hover:bg-background' : 'bg-card opacity-0 group-hover:opacity-100 hover:bg-background'}`}
      >
        {isSelected && <Check className="w-3 h-3 text-foreground" strokeWidth={4} />}
      </div>
      <div className="w-12 h-12 bg-[#FFD600] rounded-[10px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black] group-hover:bg-card transition-colors shrink-0">
        <Folder className="w-6 h-6 text-foreground fill-current" />
      </div>
      <h3 className="font-heading font-bold text-[16px] text-foreground truncate flex-1">{folder.name}</h3>

      {canOrganize && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isDeleting}
              onClick={(e) => e.stopPropagation()}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-background flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none outline-none focus:outline-none shrink-0"
            >
              {isDeleting
                ? <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                : <MoreVertical className="w-4 h-4 text-foreground" />
              }
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 bg-card border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] p-1.5 z-50"
          >
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onRename() }}
              className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none"
            >
              <Pencil className="w-4 h-4 text-[#00C853]" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onOrganize() }}
              className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none"
            >
              <Settings2 className="w-4 h-4 text-[#0057FF]" /> Organize
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted my-1" />
            <DropdownMenuItem
              onClick={handleDelete}
              className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium text-[#FF3B30] focus:bg-[#FF3B30] focus:text-white px-2 py-1.5 rounded-[0.5rem] outline-none transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [tagInput, setTagInput] = useState("")

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, "")
    if (t && !tags.includes(t)) onChange([...tags, t])
    setTagInput("")
  }

  return (
    <div className="space-y-2">
      <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <Tag className="w-3.5 h-3.5" /> Tags
      </Label>
      <div className="flex gap-2">
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
          placeholder="Type a tag and press Enter…"
          className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px] flex-1"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 rounded-[0.75rem] border-[2px] border-foreground bg-background shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
        >
          <Plus className="w-4 h-4 text-foreground" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-[100px] border-[1.5px] border-foreground bg-[#FFD600] shadow-[2px_2px_0px_black] font-mono text-[12px] font-medium text-foreground"
            >
              #{t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="ml-1 hover:opacity-60"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateFolderModal({ isOpen, onClose, communityId, currentFolderId }: { isOpen: boolean, onClose: () => void, communityId: string, currentFolderId: string | null }) {
  const [name, setName] = useState("")
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => createModuleVaultFolder(communityId, { name, parent_id: currentFolderId }),
    onSuccess: () => {
      toast.success("Folder Created")
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", communityId] })
      handleClose()
    },
    onError: (err: any) => toast.error(err.message)
  })

  const handleClose = () => { setName(""); onClose() }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-6">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[20px] text-foreground">New Folder</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase">Folder Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="border-[2px] border-foreground rounded-[1rem] shadow-[2px_2px_0_black]"
              placeholder="e.g. Past Papers"
            />
          </div>
        </div>
        <DialogFooter>
          <button onClick={handleClose} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#0057FF] text-white shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CommunityOrganizeModal({ isOpen, onClose, communityId, item, folders }: { isOpen: boolean, onClose: () => void, communityId: string, item: any, folders: any[] }) {
  const [tags, setTags] = useState<string[]>(item?.tags || [])
  const [folderId, setFolderId] = useState<string>(item?.folder_id || "null")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => updateModuleVaultItem(communityId, item.id, { tags, folder_id: folderId }),
    onSuccess: () => {
      toast.success("Changes Saved")
      queryClient.invalidateQueries({ queryKey: ["communityVault", communityId] })
      onClose()
    },
    onError: (err: any) => toast.error(err.message)
  })

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-6 overflow-visible">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[20px] text-foreground flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#0057FF]" /> Organize
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase">Destination Folder</Label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full border-[2px] border-foreground rounded-[1rem] shadow-[2px_2px_0_black] h-10 px-3 bg-card font-sans text-[14px]"
            >
              <option value="null">Root (No Folder)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <TagEditor tags={tags} onChange={setTags} />
        </div>
        <DialogFooter className="mt-2 text-right">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] text-foreground shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type UploadItem = {
  id: string;
  file: File;
  customName: string;
  tags: string[];
  relativePath: string;
}

function CommunityUploadModal({ isOpen, onClose, communityId, currentFolderId, initialFiles = [] }: { isOpen: boolean, onClose: () => void, communityId: string, currentFolderId: string | null, initialFiles?: File[] }) {
  const [isUploading, setIsUploading] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [globalTags, setGlobalTags] = useState<string[]>([])

  useEffect(() => {
    if (isOpen && initialFiles.length > 0) {
      const newItems = initialFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        customName: f.name,
        tags: [],
        relativePath: f.webkitRelativePath || ""
      }))
      setItems(prev => [...prev, ...newItems])
    }
  }, [isOpen, initialFiles])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        customName: f.name,
        tags: [],
        relativePath: f.webkitRelativePath || ""
      }))
      setItems(prev => [...prev, ...newItems])
    }
    // reset input so the same files can be selected again if needed
    e.target.value = ""
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const updateItem = (id: string, updates: Partial<UploadItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const handleSubmit = async () => {
    if (items.length === 0) return
    setIsUploading(true)
    const toastId = toast.loading(`Uploading and securing ${items.length} file(s)...`)

    try {
      const folderMap = new Map<string, string>()

      const getFolderId = async (pathParts: string[], baseFolderId: string | null) => {
        let currentParent = baseFolderId
        let currentPath = ""

        for (const part of pathParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (folderMap.has(currentPath)) {
            currentParent = folderMap.get(currentPath)!
          } else {
            const newFolder = await createModuleVaultFolder(communityId, { name: part, parent_id: currentParent })
            folderMap.set(currentPath, newFolder.id)
            currentParent = newFolder.id
          }
        }
        return currentParent
      }

      // Sequential upload to prevent overwhelming the server
      for (const item of items) {
        let targetFolderId = currentFolderId

        if (item.relativePath) {
          const parts = item.relativePath.split('/')
          const folderParts = parts.slice(0, -1)
          if (folderParts.length > 0) {
            targetFolderId = await getFolderId(folderParts, currentFolderId)
          }
        }

        const formData = new FormData()
        // Provide the basename as the 3rd argument to prevent FormData parsing errors with webkitRelativePath
        const finalName = item.customName.trim() || item.file.name
        formData.append("file", item.file, finalName)

        const combinedTags = Array.from(new Set([...globalTags, ...item.tags]))
        if (combinedTags.length > 0) formData.append("tags", JSON.stringify(combinedTags))

        const res = await fetch("/api/vault/upload", { method: "POST", body: formData })
        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || "Upload failed")
        }

        // Share to community
        await shareToModuleVault(communityId, {
          vault_item_id: result.vaultItem.id,
          folder_id: targetFolderId
        })
      }

      toast.success("Files uploaded and shared!", { id: toastId })

      // Real-time grid invalidate & auto-closure
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", communityId] })
      queryClient.invalidateQueries({ queryKey: ["communityVault", communityId] })
      handleClose()
    } catch (err: any) {
      toast.error(err.message || "Network error during upload.", { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setItems([])
    setGlobalTags([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-lg p-8 max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground">
            Upload & Share
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex-1 overflow-hidden flex flex-col">
          {/* Drop zones */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div
              className="border-[2px] border-dashed border-foreground rounded-[1.25rem] bg-background p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted transition-colors text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-8 h-8 bg-[#0057FF] rounded-[8px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <p className="font-heading font-bold text-[13px] text-foreground">Upload Files</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            <div
              className="border-[2px] border-dashed border-foreground rounded-[1.25rem] bg-background p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted transition-colors text-center"
              onClick={() => folderInputRef.current?.click()}
            >
              <div className="w-8 h-8 bg-[#0057FF] rounded-[8px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                <FolderPlus className="w-4 h-4 text-white" />
              </div>
              <p className="font-heading font-bold text-[13px] text-foreground">Upload Folder</p>
              {/* @ts-expect-error - webkitdirectory is a non-standard attribute but widely supported */}
              <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple className="hidden" onChange={handleFileSelect} />
            </div>
          </div>

          <div className="mt-4 shrink-0">
            <Label className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
              Global Tags (Applies to all)
            </Label>
            <TagEditor tags={globalTags} onChange={setGlobalTags} />
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex-1 overflow-y-auto pr-2 border-t-[2px] border-border pt-4 min-h-[150px]">
              <div className="flex justify-between items-center mb-3">
                <span className="font-heading font-bold text-[14px]">Selected ({items.length})</span>
                <button onClick={() => setItems([])} className="text-[12px] font-bold text-[#FF3B30] hover:underline">Clear All</button>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="bg-background border-[2px] border-foreground rounded-[1rem] p-3 flex flex-col gap-2 relative group">
                    <button onClick={() => removeItem(item.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background rounded-full">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card flex items-center justify-center shrink-0">
                        <File className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <input
                          value={item.customName}
                          onChange={(e) => updateItem(item.id, { customName: e.target.value })}
                          className="font-heading font-bold text-[13px] text-foreground bg-transparent border-b border-transparent hover:border-foreground focus:border-foreground outline-none w-full truncate pb-0.5"
                          placeholder="Filename..."
                        />
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{formatBytes(item.file.size)}</p>
                      </div>
                    </div>
                    <div className="pt-1">
                      <TagEditor tags={item.tags} onChange={(tags) => updateItem(item.id, { tags })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={items.length === 0 || isUploading}
            className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#00C853] text-white shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Uploading…" : "Upload & Share"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PublishFromVaultModal({
  isOpen,
  onClose,
  communityId,
  targetFolderId
}: {
  isOpen: boolean,
  onClose: () => void,
  communityId: string,
  targetFolderId: string | null
}) {
  const queryClient = useQueryClient()
  const [personalFolderStack, setPersonalFolderStack] = useState<{ id: string, name: string }[]>([])
  const currentPersonalFolderId = personalFolderStack.length > 0 ? personalFolderStack[personalFolderStack.length - 1].id : null

  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  const { data: myVaultItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["vaultItems"],
    queryFn: async () => {
      const res = await fetch("/api/vault/items")
      if (!res.ok) throw new Error("Failed to fetch personal vault")
      const json = await res.json()
      return json.data
    },
    enabled: isOpen
  })

  const { data: myFolders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["vaultFolders"],
    queryFn: async () => {
      const res = await fetch("/api/vault/folders")
      if (!res.ok) throw new Error("Failed to fetch personal folders")
      const json = await res.json()
      return json.data
    },
    enabled: isOpen
  })

  const isLoading = itemsLoading || foldersLoading

  // Filter items and folders for the current view
  const currentItems = myVaultItems.filter((item: any) => (item.folder_id || null) === (currentPersonalFolderId || null))
  const currentFolders = myFolders.filter((f: any) => (f.parent_id || null) === (currentPersonalFolderId || null))

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleFolderSelection = (id: string) => {
    setSelectedFolders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handlePublish = async () => {
    if (selectedItems.length === 0 && selectedFolders.length === 0) return
    setIsPublishing(true)
    const toastId = toast.loading("Publishing items to community...")

    try {
      // 1. Publish files/links
      for (const itemId of selectedItems) {
        await shareToModuleVault(communityId, { vault_item_id: itemId, folder_id: targetFolderId })
      }

      // 2. Publish folders (recursive)
      for (const folderId of selectedFolders) {
        await publishFolderRecursive(folderId, targetFolderId)
      }

      toast.success("Successfully published selected items!", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["communityVault", communityId] })
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", communityId] })
      onClose()
      // Clear selection
      setSelectedItems([])
      setSelectedFolders([])
      setPersonalFolderStack([])
    } catch (err: any) {
      toast.error(err.message || "Failed to publish some items", { id: toastId })
    } finally {
      setIsPublishing(false)
    }
  }

  const publishFolderRecursive = async (personalFolderId: string, communityParentId: string | null) => {
    const personalFolder = myFolders.find((f: any) => f.id === personalFolderId)
    if (!personalFolder) return

    // Create the folder in the community vault
    const newCommunityFolder = await createModuleVaultFolder(communityId, { name: personalFolder.name, parent_id: communityParentId })

    // Find all items in this personal folder
    const folderItems = myVaultItems.filter((item: any) => item.folder_id === personalFolderId)
    for (const item of folderItems) {
      await shareToModuleVault(communityId, { vault_item_id: item.id, folder_id: newCommunityFolder.id })
    }

    // Find all subfolders and recurse
    const subFolders = myFolders.filter((f: any) => f.parent_id === personalFolderId)
    for (const sub of subFolders) {
      await publishFolderRecursive(sub.id, newCommunityFolder.id)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && !isPublishing && onClose()}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-2xl p-6 flex flex-col h-[85vh]">
        <DialogHeader className="mb-4 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#FFD600] flex items-center justify-center shadow-[2px_2px_0px_black]">
                <FolderSync className="w-4 h-4 text-foreground" />
              </div>
              Publish from Personal Vault
            </DialogTitle>
            <button
              onClick={onClose}
              disabled={isPublishing}
              className="w-8 h-8 rounded-full border-[2px] border-foreground flex items-center justify-center hover:bg-background transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-sans text-[14px] text-muted-foreground">Select files and folders to share. Folders maintain their structure.</p>
        </DialogHeader>

        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 bg-background p-2 rounded-[0.75rem] border-[2px] border-foreground overflow-x-auto no-scrollbar">
          <button
            onClick={() => setPersonalFolderStack([])}
            className={`font-mono text-[12px] px-2 py-1 rounded-[4px] hover:bg-muted ${personalFolderStack.length === 0 ? 'bg-foreground text-white' : 'text-foreground'}`}
          >
            ROOT
          </button>
          {personalFolderStack.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 shrink-0">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => setPersonalFolderStack(prev => prev.slice(0, i + 1))}
                className={`font-mono text-[12px] px-2 py-1 rounded-[4px] hover:bg-muted ${i === personalFolderStack.length - 1 ? 'bg-foreground text-white' : 'text-foreground'}`}
              >
                {f.name}
              </button>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-foreground" />
            </div>
          ) : currentItems.length === 0 && currentFolders.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 rounded-[16px] bg-background border-[2px] border-foreground mx-auto flex items-center justify-center">
                <File className="w-8 h-8 text-foreground opacity-30" />
              </div>
              <h3 className="font-heading font-bold text-[18px]">This folder is empty</h3>
              <p className="font-sans text-[14px] text-muted-foreground">Navigate back or upload files to your personal vault.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {/* Render Folders */}
              {currentFolders.map((f: any) => (
                <div
                  key={f.id}
                  className={`group flex items-center gap-3 p-3 rounded-[1rem] border-[2px] transition-all text-left shadow-[2px_2px_0px_black] ${selectedFolders.includes(f.id)
                    ? 'border-[#FFD600] bg-[#FFFBDE] shadow-[2px_2px_0px_#FFD600]'
                    : 'border-foreground bg-card hover:bg-background'
                    }`}
                >
                  <button
                    onClick={() => toggleFolderSelection(f.id)}
                    className={`w-5 h-5 rounded-[4px] border-[2px] border-foreground flex items-center justify-center transition-all ${selectedFolders.includes(f.id) ? 'bg-[#FFD600]' : 'bg-card'}`}
                  >
                    {selectedFolders.includes(f.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </button>
                  <div
                    className="flex-1 flex items-center gap-3 cursor-pointer"
                    onClick={() => setPersonalFolderStack(prev => [...prev, { id: f.id, name: f.name }])}
                  >
                    <div className="w-10 h-10 rounded-[8px] bg-[#FFD600] border-[1.5px] border-foreground flex items-center justify-center shadow-[1px_1px_0px_black]">
                      <Folder className="w-5 h-5 text-white fill-current" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-bold text-[14px] text-foreground truncate">{f.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">Folder</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/70 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}

              {/* Render Files */}
              {currentItems.map((item: any) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-3 p-3 rounded-[1rem] border-[2px] transition-all text-left shadow-[2px_2px_0px_black] ${selectedItems.includes(item.id)
                    ? 'border-[#0057FF] bg-[#EEF3FF] shadow-[2px_2px_0px_#0057FF]'
                    : 'border-foreground bg-card hover:bg-background'
                    }`}
                >
                  <button
                    onClick={() => toggleItemSelection(item.id)}
                    className={`w-5 h-5 rounded-[4px] border-[2px] border-foreground flex items-center justify-center transition-all ${selectedItems.includes(item.id) ? 'bg-[#0057FF]' : 'bg-card'}`}
                  >
                    {selectedItems.includes(item.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </button>
                  <div
                    className="flex-1 flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleItemSelection(item.id)}
                  >
                    <div className="w-10 h-10 rounded-[8px] bg-card border-[1.5px] border-foreground flex items-center justify-center shadow-[1px_1px_0px_black]">
                      {getFileIcon(item.files?.mime_type || "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-bold text-[14px] text-foreground truncate">
                        {item.item_type === "link" ? (item.title || item.url) : (item.files?.filename || "Unknown File")}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {item.item_type === "link" ? "Link" : formatBytes(item.files?.size_bytes || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="mt-6 pt-4 border-t-[2px] border-border flex items-center justify-between bg-card shrink-0">
          <div className="font-heading font-bold text-[14px]">
            {selectedItems.length + selectedFolders.length > 0 ? (
              <span className="text-[#0057FF]">{selectedItems.length + selectedFolders.length} items selected</span>
            ) : (
              <span className="text-muted-foreground/70">Select items to publish</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPublishing}
              className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || (selectedItems.length === 0 && selectedFolders.length === 0)}
              className="px-6 py-2.5 rounded-[0.875rem] border-[3px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSync className="w-4 h-4" />}
              {isPublishing ? "Publishing..." : "Publish Selected"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


function CommunityAddLinkModal({ isOpen, onClose, communityId, currentFolderId }: { isOpen: boolean, onClose: () => void, communityId: string, currentFolderId: string | null }) {
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [linkTags, setLinkTags] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})
  const queryClient = useQueryClient()

  const validate = () => {
    const e: { title?: string; url?: string } = {}
    if (!title.trim()) e.title = "Title is required"
    if (!url.trim()) {
      e.url = "URL is required"
    } else {
      try { new URL(url.trim()) } catch { e.url = "Enter a valid URL (include https://)" }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    const toastId = toast.loading("Saving link to Vault...")
    try {
      const savedLink = await createVaultLink({
        title: title.trim(),
        url: url.trim(),
        tags: linkTags,
      })

      await shareToModuleVault(communityId, {
        vault_item_id: savedLink.id,
        folder_id: currentFolderId
      })

      toast.success("Link saved and shared!", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["communityVault", communityId] })
      handleClose()
    } catch (err: any) {
      toast.error(err.message || "Could not save link", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setTitle("")
    setUrl("")
    setLinkTags([])
    setErrors({})
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-md p-8">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#0057FF] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            Add External Link
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">Title</Label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
              placeholder="e.g. React Docs, Lecture Recording…"
              autoFocus
              className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
            />
            {errors.title && <p className="font-sans text-[12px] text-[#FF3B30]">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">URL</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErrors(prev => ({ ...prev, url: undefined })) }}
              placeholder="https://example.com"
              className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
            />
            {errors.url && <p className="font-sans text-[12px] text-[#FF3B30]">{errors.url}</p>}
          </div>

          <TagEditor tags={linkTags} onChange={setLinkTags} />

          <DialogFooter className="gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#0057FF] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-white hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {isSaving ? "Saving…" : "Save Link"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CommunityOrganizeFolderModal({ isOpen, onClose, communityId, folder, folders }: { isOpen: boolean, onClose: () => void, communityId: string, folder: any, folders: any[] }) {
  const [parentId, setParentId] = useState<string>(folder?.parent_id || "null")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => updateModuleVaultFolder(communityId, folder.id, { parent_id: parentId }),
    onSuccess: () => {
      toast.success("Folder Moved")
      queryClient.invalidateQueries({ queryKey: ["communityVaultFolders", communityId] })
      onClose()
    },
    onError: (err: any) => toast.error(err.message)
  })

  // Filter out current folder to prevent moving into itself
  const validFolders = folders.filter(f => f.id !== folder?.id)

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-6 overflow-visible">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[20px] text-foreground flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#0057FF]" /> Move Folder
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase">Destination Folder</Label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full border-[2px] border-foreground rounded-[1rem] shadow-[2px_2px_0_black] h-10 px-3 bg-card font-sans text-[14px]"
            >
              <option value="null">Root (No Folder)</option>
              {validFolders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="mt-2 text-right">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] text-foreground shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Move Folder"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
