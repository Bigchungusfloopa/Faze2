"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Upload,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  Image as ImageIcon,
  File,
  FileCode,
  Filter,
  Video,
  Music,
  Archive,
  Trash2,
  Download,
  Eye,
  Pencil,
  Search,
  X,
  Plus,
  Tag,
  FolderInput,
  Home,
  MoreVertical,
  Link2,
  ExternalLink,
  PlayCircle,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence, useDragControls, useMotionValue } from "framer-motion"
import { useDragAndDrop } from "@/hooks/useDragAndDrop"
import { useVaultWindowStore } from "@/lib/stores/useVaultWindowStore"
import {
  createVaultFolder,
  updateVaultFolder,
  deleteVaultFolder,
  deleteVaultItem,
  updateVaultItem,
  createVaultLink,
} from "@/actions/vault"
import type { VaultFolder, VaultItem } from "@/types/vault"

// ─── Types ────────────────────────────────────────────────────────────────────
interface EditFormValues {
  filename: string
}

interface NewFolderFormValues {
  name: string
}

export type WindowType = "pdf" | "image" | "youtube" | "drive_file" | "drive_folder"

export interface VaultWindow {
  id: string
  type: WindowType
  url: string
  title: string
  zIndex: number
  isMinimized?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FOLDER_COLORS = [
  "#FFD600", "#0057FF", "#FF3CAC", "#00C853", "#FF6B00", "#FF3B30",
]

const getFolderColor = (id: string) =>
  FOLDER_COLORS[
  id.charCodeAt(0) % FOLDER_COLORS.length
  ]

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
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const formatDate = (isoString: string) =>
  new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })

// Build a breadcrumb trail from flat folder list + current id
function buildBreadcrumb(
  folders: VaultFolder[],
  currentId: string | null
): VaultFolder[] {
  if (!currentId) return []
  const map = new Map(folders.map((f) => [f.id, f]))
  const trail: VaultFolder[] = []
  let node = map.get(currentId)
  while (node) {
    trail.unshift(node)
    node = node.parent_id ? map.get(node.parent_id) : undefined
  }
  return trail
}

// ─── Shared Tag Editor ────────────────────────────────────────────────────────
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

// ─── New Folder Modal ─────────────────────────────────────────────────────────
function NewFolderModal({
  isOpen,
  onClose,
  onCreated,
  parentId,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  parentId: string | null
}) {
  const [isCreating, setIsCreating] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewFolderFormValues>({
    defaultValues: { name: "" },
  })

  const onSubmit = async (values: NewFolderFormValues) => {
    setIsCreating(true)
    try {
      await createVaultFolder(values.name.trim(), parentId)
      toast.success(`Folder "${values.name.trim()}" created!`)
      onCreated()
      reset()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Could not create folder")
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-8">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#FFD600] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <FolderPlus className="w-4 h-4 text-foreground" />
            </div>
            New Folder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-3">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
              Folder Name
            </Label>
            <Input
              {...register("name", { required: "A folder name is required" })}
              autoFocus
              placeholder="e.g. Semester 1, Projects…"
              className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
            />
            {errors.name && (
              <p className="font-sans text-[12px] text-[#FF3B30]">{errors.name.message}</p>
            )}
          </div>

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
              disabled={isCreating}
              className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {isCreating ? "Creating…" : "Create Folder"}
            </button>
          </DialogFooter>
        </form>
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
  isTooLarge?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  currentFolderId,
  initialFiles = [],
}: {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
  currentFolderId: string | null
  initialFiles?: File[]
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [globalTags, setGlobalTags] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Seed items when the modal is opened with pre-dropped files
  useEffect(() => {
    if (isOpen && initialFiles.length > 0) {
      setItems(initialFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        customName: f.name,
        tags: [],
        relativePath: f.webkitRelativePath || "",
        isTooLarge: f.size > MAX_FILE_SIZE,
      })))
    }
  }, [isOpen])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        customName: f.name,
        tags: [],
        relativePath: f.webkitRelativePath || "",
        isTooLarge: f.size > MAX_FILE_SIZE,
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
    const validItems = items.filter(i => !i.isTooLarge)
    if (validItems.length === 0) return
    setIsUploading(true)
    const toastId = toast.loading(`Uploading ${validItems.length} file(s)…`)

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
            const folder = await createVaultFolder(part, currentParent)
            folderMap.set(currentPath, folder.id)
            currentParent = folder.id
          }
        }
        return currentParent
      }

      // Sequential upload to prevent overwhelming the Next.js body parser with massive folder uploads
      for (const item of validItems) {
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
        if (targetFolderId) formData.append("folder_id", targetFolderId)

        const res = await fetch("/api/vault/upload", { method: "POST", body: formData })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Upload failed")
        }
      }
      toast.success("Files secured in Vault!", { id: toastId })
      onUploadComplete()
      queryClient.invalidateQueries({ queryKey: ["vaultFolders"] })
      handleClose()
    } catch (e: any) {
      toast.error(e.message || "Upload failed.", { id: toastId })
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
            Upload to Vault
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex-1 overflow-hidden flex flex-col">
          {/* Drop zones */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div
              className="border-[2px] border-dashed border-foreground rounded-[1.25rem] bg-background p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted transition-colors text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-8 h-8 bg-[#FFD600] rounded-[8px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                <Upload className="w-4 h-4 text-foreground" />
              </div>
              <p className="font-heading font-bold text-[13px] text-foreground">Upload Files</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            <div
              className="border-[2px] border-dashed border-foreground rounded-[1.25rem] bg-background p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted transition-colors text-center"
              onClick={() => folderInputRef.current?.click()}
            >
              <div className="w-8 h-8 bg-[#FFD600] rounded-[8px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black]">
                <FolderPlus className="w-4 h-4 text-foreground" />
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
                  <div key={item.id} className={`bg-background border-[2px] ${item.isTooLarge ? 'border-[#FF3B30] bg-[#FF3B30]/5' : 'border-foreground'} rounded-[1rem] p-3 flex flex-col gap-2 relative group`}>
                    <button onClick={() => removeItem(item.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background rounded-full">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-[8px] border-[1.5px] ${item.isTooLarge ? 'border-[#FF3B30] text-[#FF3B30]' : 'border-foreground text-foreground'} bg-card flex items-center justify-center shrink-0`}>
                        <File className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <input
                          value={item.customName}
                          onChange={(e) => updateItem(item.id, { customName: e.target.value })}
                          className={`font-heading font-bold text-[13px] ${item.isTooLarge ? 'text-[#FF3B30]' : 'text-foreground'} bg-transparent border-b border-transparent hover:border-foreground focus:border-foreground outline-none w-full truncate pb-0.5`}
                          placeholder="Filename..."
                          disabled={item.isTooLarge}
                        />
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`font-mono text-[10px] ${item.isTooLarge ? 'text-[#FF3B30] font-bold' : 'text-muted-foreground'}`}>{formatBytes(item.file.size)}</p>
                          {item.isTooLarge && <span className="font-mono text-[10px] text-[#FF3B30] font-bold bg-[#FF3B30]/10 px-1.5 py-0.5 rounded-sm">Exceeds 20MB limit</span>}
                        </div>
                      </div>
                    </div>
                    {!item.isTooLarge && (
                      <div className="pt-1">
                        <TagEditor tags={item.tags} onChange={(tags) => updateItem(item.id, { tags })} />
                      </div>
                    )}
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
            disabled={items.filter(i => !i.isTooLarge).length === 0 || isUploading}
            className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Link Modal ───────────────────────────────────────────────────────────
function AddLinkModal({
  isOpen,
  onClose,
  onAdded,
  currentFolderId,
}: {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
  currentFolderId: string | null
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [linkTags, setLinkTags] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})

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
    try {
      await createVaultLink({
        title: title.trim(),
        url: url.trim(),
        tags: linkTags,
        folder_id: currentFolderId,
      })
      toast.success("Link saved to Vault!")
      onAdded()
      handleClose()
    } catch (err: any) {
      toast.error(err.message || "Could not save link")
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
          {/* Title */}
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
              placeholder="e.g. React Docs, Lecture Recording…"
              autoFocus
              className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
            />
            {errors.title && (
              <p className="font-sans text-[12px] text-[#FF3B30]">{errors.title}</p>
            )}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
              URL
            </Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErrors(prev => ({ ...prev, url: undefined })) }}
              placeholder="https://example.com"
              className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
            />
            {errors.url && (
              <p className="font-sans text-[12px] text-[#FF3B30]">{errors.url}</p>
            )}
          </div>

          {/* Tags */}
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────
// key={item.id} on the wrapper in VaultPage guarantees fresh mount per file
function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: VaultItem
  onClose: () => void
  onSaved: () => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [tags, setTags] = useState<string[]>(item.tags ?? [])

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormValues>({
    defaultValues: { filename: item.files?.filename ?? "" },
  })

  const onSubmit = async (values: EditFormValues) => {
    setIsSaving(true)
    try {
      await updateVaultItem(item.id, { filename: values.filename.trim(), tags })
      toast.success("File updated successfully!")
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Update failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-md p-8">
      <DialogHeader>
        <DialogTitle className="font-heading font-extrabold text-[22px] text-foreground">
          Edit File
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
        <div className="space-y-2">
          <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
            Filename
          </Label>
          <Input
            {...register("filename", { required: "Filename is required" })}
            className="border-[2px] border-foreground rounded-[0.75rem] font-sans text-[14px]"
          />
          {errors.filename && (
            <p className="font-sans text-[12px] text-[#FF3B30]">{errors.filename.message}</p>
          )}
        </div>
        <TagEditor tags={tags} onChange={setTags} />
        <DialogFooter className="pt-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ─── Move Modal ───────────────────────────────────────────────────────────────
function MoveModal({
  isOpen,
  onClose,
  onMoved,
  folders,
  currentFolderId,
  itemType,
  itemId,
}: {
  isOpen: boolean
  onClose: () => void
  onMoved: () => void
  folders: VaultFolder[]
  currentFolderId: string | null
  itemType: "file" | "folder" | null
  itemId: string | null
}) {
  const [isMoving, setIsMoving] = useState(false)

  if (!isOpen || !itemId || !itemType) return null

  // Prevent a folder from moving into itself or its own children
  const getSubTreeIds = (id: string, all: VaultFolder[]): string[] => {
    const children = all.filter(f => f.parent_id === id).map(f => f.id)
    return [id, ...children.flatMap(cid => getSubTreeIds(cid, all))]
  }
  const invalidTargets = itemType === "folder" ? getSubTreeIds(itemId, folders) : []

  // Ensure root isn't invalid unless item is literally the root folder (impossible)
  const validFolders = folders.filter(f => !invalidTargets.includes(f.id))

  const handleMove = async (targetFolderId: string | null) => {
    setIsMoving(true)
    try {
      if (itemType === "folder") {
        await updateVaultFolder(itemId, { parent_id: targetFolderId })
      } else {
        await updateVaultItem(itemId, { folder_id: targetFolderId })
      }
      toast.success("Moved successfully!")
      onMoved()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Failed to move item")
    } finally {
      setIsMoving(false)
    }
  }

  // Recursive render for folder picker
  const renderPickerTree = (parentId: string | null, depth: number = 0) => {
    const children = validFolders.filter(f => f.parent_id === parentId)
    if (children.length === 0) return null
    return (
      <ul className="space-y-1">
        {children.map(folder => (
          <li key={folder.id}>
            <button
              disabled={isMoving}
              onClick={() => handleMove(folder.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] border-[1.5px] border-transparent hover:border-foreground hover:bg-background hover:shadow-[2px_2px_0px_black] transition-all text-left font-sans text-[13px] font-medium text-foreground group"
              style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
              <Folder className="w-4 h-4 text-muted-foreground group-hover:text-[#FFD600] group-hover:fill-[#FFD600] transition-colors" />
              <span className="truncate">{folder.name}</span>
            </button>
            {renderPickerTree(folder.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-sm p-6 overflow-hidden flex flex-col max-h-[80vh]">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="font-heading font-extrabold text-[20px] text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] border-[2px] border-foreground bg-[#0057FF] flex items-center justify-center shadow-[2px_2px_0px_black]">
              <FolderInput className="w-4 h-4 text-white" />
            </div>
            Move To...
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
          {/* Root option */}
          <button
            disabled={isMoving}
            onClick={() => handleMove(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] border-[1.5px] border-transparent hover:border-foreground hover:bg-background hover:shadow-[2px_2px_0px_black] transition-all text-left font-sans text-[13px] font-medium text-foreground group"
          >
            <Home className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold">Vault Root (All Files)</span>
          </button>

          <div className="my-2 h-[2px] w-full bg-muted" />

          {validFolders.length > 0 ? (
            renderPickerTree(null)
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground/70 text-center pt-4">No nested folders available</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Folder Card ──────────────────────────────────────────────────────────────
function FolderCard({
  folder,
  onClick,
  onRename,
  onMove,
  onDelete,
  isDropTarget = false,
  isSelected = false,
  onToggle,
  selectionMode = false,
  onDragOver,
  onDropFile,
}: {
  folder: VaultFolder
  onClick: () => void
  onRename: (folder: VaultFolder) => void
  onMove: (folder: VaultFolder) => void
  onDelete: (folder: VaultFolder) => void
  isDropTarget?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  selectionMode?: boolean
  onDragOver: (id: string | null) => void
  onDropFile: (type: "file" | "folder", id: string, targetId: string | null) => void
}) {
  const color = getFolderColor(folder.id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const dataStr = e.dataTransfer.getData("application/json")
      if (!dataStr) return
      const data = JSON.parse(dataStr)
      if (data.type && data.id && data.id !== folder.id) {
        onDropFile(data.type, data.id, folder.id)
      }
    } catch { /* ignore */ }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Permanently delete folder "${folder.name}" and move its contents to the parent folder?`)) return
    setIsDeleting(true)
    const toastId = toast.loading("Deleting folder...")
    try {
      await deleteVaultFolder(folder.id)
      toast.success("Folder deleted", { id: toastId })
      onDelete(folder)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete", { id: toastId })
      setIsDeleting(false)
    }
  }

  return (
    <div
      data-drop-target={folder.id}
      draggable={!selectionMode}
      onDragStart={(e: any) => {
        e.stopPropagation()
        e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", id: folder.id }))
        e.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={selectionMode ? () => onToggle?.(folder.id) : onClick}
      className={`group relative border-[2px] rounded-[1.5rem] p-5 transition-all duration-150 select-none overflow-hidden flex items-center gap-4 ${isSelected
        ? "bg-[#FFFBDE] border-[#FFD600] shadow-[4px_4px_0px_#FFD600] ring-[3px] ring-[#FFD60066]"
        : isDragOver
          ? "border-[#0057FF] bg-[#F0F7FF] shadow-[4px_4px_0px_#0057FF] scale-105 cursor-copy"
          : "bg-card border-foreground shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
        } ${selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle?.(folder.id) }}
        className={`w-5 h-5 rounded-[6px] border-[2px] border-foreground flex items-center justify-center cursor-pointer transition-all shrink-0 ${isSelected ? 'bg-[#FFD600]' : selectionMode ? 'bg-card opacity-100 hover:bg-background' : 'bg-card opacity-0 group-hover:opacity-100 hover:bg-background'}`}
      >
        {isSelected && <Check className="w-3 h-3 text-foreground" strokeWidth={4} />}
      </div>
      <div
        className="w-12 h-12 bg-[#FFD600] rounded-[10px] border-[2px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_black] group-hover:bg-card transition-colors shrink-0"
      >
        <Folder className="w-6 h-6 text-foreground fill-current" />
      </div>
      <h3 className="font-heading font-bold text-[15px] text-foreground truncate flex-1" title={folder.name}>
        {folder.name}
      </h3>

      {/* Folder Action Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isDeleting}
            onClick={(e) => e.stopPropagation()}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-background flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none outline-none focus:outline-none"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-foreground" /> : <MoreVertical className="w-4 h-4 text-foreground" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 bg-card border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] p-1.5 z-50"
        >
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(folder); }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none">
            <Pencil className="w-4 h-4 text-[#00C853]" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(folder); }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none">
            <FolderInput className="w-4 h-4 text-[#FF6B00]" /> Move
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-muted my-1" />
          <DropdownMenuItem onClick={handleDelete} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium text-[#FF3B30] focus:bg-[#FF3B30] focus:text-white px-2 py-1.5 rounded-[0.5rem] outline-none transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Link helpers ────────────────────────────────────────────────────────────
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

function getGoogleDriveInfo(url: string): { type: "file" | "folder", id: string } | null {
  try {
    const u = new URL(url)
    const path = u.pathname
    const fileMatch = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return { type: "file", id: fileMatch[1] }
    const folderMatch = path.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return { type: "folder", id: folderMatch[1] }
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


// ─── Native File Viewer ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VaultWindowRenderer({
  win,
  onClose,
  onDownload,
  onFocus,
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

  // Image zoom
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

  // Window size
  const [size, setSize] = useState({ w: 900, h: 600 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startXVal: number } | null>(null)

  const onResizeStart = (e: React.MouseEvent, direction: 'se' | 'sw') => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startXVal: x.get() }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dw = ev.clientX - resizeRef.current.startX
      const dh = ev.clientY - resizeRef.current.startY

      let newW = resizeRef.current.startW
      const newH = Math.max(320, resizeRef.current.startH + dh)

      if (direction === 'se') {
        newW = Math.max(480, resizeRef.current.startW + dw)
      } else {
        newW = Math.max(480, resizeRef.current.startW - dw)
        if (newW > 480) {
          x.set(resizeRef.current.startXVal + dw)
        }
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
        pointerEvents: win.isMinimized ? 'none' : 'auto'
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
        transition: isFullscreen ? "all 0.2s ease" : "none"
      }}
      className={`viewer-chrome bg-black border-[3px] border-black p-0 flex flex-col overflow-hidden ${isFullscreen ? '' : 'rounded-[2rem] shadow-[8px_8px_0px_#FFD600]'}`}
    >
      {/* ── Header ── */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between px-5 py-3 border-b-[2px] border-[#222] shrink-0 select-none cursor-move"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="viewer-file-icon w-7 h-7 bg-[#FFD600] rounded-[7px] border-[2px] border-black flex items-center justify-center shrink-0">
            {isImage ? <ImageIcon className="w-3.5 h-3.5 text-foreground" /> :
             isYoutube ? <PlayCircle className="w-3.5 h-3.5 text-foreground" /> :
             <FileText className="w-3.5 h-3.5 text-foreground" />}
          </div>
          <span className="font-heading font-bold text-[14px] text-white truncate">{win.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 cursor-default" onMouseDown={e => e.stopPropagation()}>
          {isImage && (
            <div className="flex items-center gap-1 bg-[#1A1A1A] border-[2px] border-[#333] rounded-[0.75rem] px-1 py-1">
              <button onClick={zoomOut} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom out">−</button>
              <button onClick={zoomReset} className="px-2 h-7 rounded-[6px] hover:bg-[#333] font-mono text-[11px] text-[#999] transition-all min-w-[42px] text-center" title="Reset zoom">{Math.round(scale * 100)}%</button>
              <button onClick={zoomIn} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom in">+</button>
            </div>
          )}

          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all"
            title={isFullscreen ? "Restore" : "Fullscreen"}
          >
            {isFullscreen
              ? <Minimize2 className="w-3.5 h-3.5 text-white" />
              : <Maximize2 className="w-3.5 h-3.5 text-white" />}
          </button>

          <button
            onClick={() => window.open(win.url, "_blank")}
            className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white" />
          </button>

          {onDownload && (
            <button
              onClick={onDownload}
              className="px-3 py-1.5 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#222] text-white font-heading font-bold text-[12px] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#FF3B30] flex items-center justify-center transition-all"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center bg-[#111] relative cursor-default"
        onWheel={handleWheel}
        onMouseDown={e => e.stopPropagation()}
      >
        {isImage && (
          <div className="min-w-full min-h-full flex items-center justify-center p-6" style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}>
            <img
              src={win.url}
              alt={win.title}
              draggable={false}
              className="object-contain rounded-[0.75rem] shadow-[0_0_60px_#0006] transition-transform duration-100 ease-out"
              style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
            />
          </div>
        )}
        {isPdf && <embed src={win.url} type="application/pdf" className="w-full h-full" />}
        {isYoutube && (
          <iframe
            src={win.url}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-none"
            title={win.title}
          />
        )}
        {isDriveFile && (
          <iframe
            src={win.url}
            allow="autoplay"
            className="w-full h-full border-none"
            title={win.title}
          />
        )}
        {isDriveFolder && (
          <iframe
            src={win.url}
            className="w-full h-full border-none bg-white"
            title={win.title}
          />
        )}
      </div>

      {/* ── Resize handles ── */}
      {!isFullscreen && (
        <>
          {/* Bottom Left */}
          <div
            onMouseDown={(e) => onResizeStart(e, 'sw')}
            className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize flex items-end justify-start p-1.5 z-50"
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M1 5L5 9M1 9H1" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          {/* Bottom Right */}
          <div
            onMouseDown={(e) => onResizeStart(e, 'se')}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1.5 z-50"
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── File Card ────────────────────────────────────────────────────────────────
function FileCard({
  item,
  folders,
  onDelete,
  onEdit,
  onMove,
  onDropFile,
  onDragOver,
  onOpenWindow,
  isSelected = false,
  onToggle,
  selectionMode = false,
}: {
  item: VaultItem
  folders: VaultFolder[]
  onDelete: () => void
  onEdit: (item: VaultItem) => void
  onMove: (item: VaultItem) => void
  onDropFile: (type: "file" | "folder", id: string, targetId: string | null) => void
  onDragOver: (folderId: string | null) => void
  onOpenWindow: (windowConfig: Omit<VaultWindow, 'id' | 'zIndex'>) => void
  isSelected?: boolean
  onToggle?: (id: string) => void
  selectionMode?: boolean
}) {
  const [isViewing, setIsViewing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const mimeType = item.files?.mime_type ?? ""
  const canNativeView = mimeType.startsWith("image/") || mimeType === "application/pdf"

  const fetchUrl = async (action: "view" | "download") => {
    const res = await fetch(`/api/vault/items/${item.id}/download?action=${action}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to get link")
    return data.url as string
  }

  const handleView = async () => {
    setIsViewing(true)
    try {
      const url = await fetchUrl("view")
      if (canNativeView) {
        onOpenWindow({
          type: mimeType.startsWith("image/") ? "image" : "pdf",
          url: url,
          title: item.files?.filename ?? "File"
        })
      } else {
        window.open(url, "_blank")
      }
    } catch (e: any) {
      toast.error(e.message || "Could not open file")
    } finally {
      setIsViewing(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const url = await fetchUrl("download")
      const a = document.createElement("a")
      a.href = url
      a.download = item.files?.filename ?? "file"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e: any) {
      toast.error(e.message || "Download failed")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    const label = item.item_type === "link" ? "this link" : "this file"
    if (!window.confirm(`Permanently delete ${label} from your Vault?`)) return
    setIsDeleting(true)
    const toastId = toast.loading("Deleting file…")
    try {
      await deleteVaultItem(item.id)
      toast.success(item.item_type === "link" ? "Link deleted" : "File deleted", { id: toastId })
      onDelete()
    } catch (e: any) {
      toast.error(e.message || "Delete failed", { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  const isLink = item.item_type === "link"
  const isBusy = isViewing || isDownloading || isDeleting
  const tags = item.tags ?? []
  const folderTrail = buildBreadcrumb(folders, item.folder_id)
  const pathString = folderTrail.length > 0
    ? folderTrail.map(f => f.name).join(" / ")
    : "Vault Root"
  const linkDomain = isLink && item.url ? getUrlDomain(item.url) : ""
  const ytVideoId = isLink && item.url ? getYouTubeVideoId(item.url) : null

  // ── Drag handling ──────────────────────────────────────────────────────────

  const handleLinkOpen = () => {
    if (ytVideoId) {
      const playlistId = getYouTubePlaylistId(item.url ?? "")
      const embedUrl = playlistId
        ? `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1`
        : `https://www.youtube.com/embed/${ytVideoId}?autoplay=1`
      onOpenWindow({
        type: "youtube",
        url: embedUrl,
        title: item.title || "YouTube Video"
      })
    } else {
      const driveInfo = getGoogleDriveInfo(item.url ?? "")
      if (driveInfo) {
        const embedUrl = driveInfo.type === "folder"
          ? `https://drive.google.com/embeddedfolderview?id=${driveInfo.id}#list`
          : `https://drive.google.com/file/d/${driveInfo.id}/preview`
        onOpenWindow({
          type: driveInfo.type === "folder" ? "drive_folder" : "drive_file",
          url: embedUrl,
          title: item.title || "Google Drive"
        })
      } else {
        window.open(item.url ?? "", "_blank", "noopener,noreferrer")
      }
    }
  }

  return (
    <>
      <div
        draggable={!selectionMode}
        onDragStart={(e: React.DragEvent) => {
          e.dataTransfer.setData("application/json", JSON.stringify({ type: "file", id: item.id }))
          e.dataTransfer.effectAllowed = "move"
        }}
        onClick={selectionMode ? () => onToggle?.(item.id) : (isLink ? handleLinkOpen : undefined)}
        className={`group relative border-[2px] rounded-[1.5rem] p-5 transition-all duration-150 select-none ${isSelected
          ? "bg-[#FFFBDE] border-[#FFD600] shadow-[4px_4px_0px_#FFD600] ring-[3px] ring-[#FFD60066]"
          : "bg-card border-foreground shadow-[4px_4px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
          } ${isLink || selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onToggle?.(item.id) }}
          className={`absolute top-4 left-4 w-5 h-5 rounded-[6px] border-[2px] border-foreground flex items-center justify-center cursor-pointer transition-all z-20 ${isSelected ? 'bg-[#FFD600]' : selectionMode ? 'bg-card opacity-100 hover:bg-background' : 'bg-card opacity-0 group-hover:opacity-100 hover:bg-background'}`}
        >
          {isSelected && <Check className="w-3 h-3 text-foreground" strokeWidth={4} />}
        </div>
        <div className="flex justify-between items-start mb-4 pl-8 relative z-10">
          <div className={`w-14 h-14 rounded-[12px] border-[2px] border-foreground flex items-center justify-center shadow-[3px_3px_0px_black] ${isLink ? getLinkBgColor(item.url ?? "") : "bg-card"
            }`}>
            {isLink
              ? getLinkIcon(item.url ?? "")
              : getFileIcon(item.files?.mime_type ?? "")}
          </div>
          <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); isLink ? handleLinkOpen() : handleView() }}
              disabled={!isLink && isBusy}
              title={isLink ? (ytVideoId ? "Watch on YouTube" : "Open link") : "View in browser"}
              className="w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-[#0057FF] hover:text-white flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-foreground disabled:opacity-40"
            >
              {isLink
                ? (ytVideoId ? <PlayCircle className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />)
                : isViewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-4 h-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isBusy}
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-[8px] border-[1.5px] border-foreground bg-card hover:bg-background flex items-center justify-center shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none outline-none focus:outline-none disabled:opacity-40"
                >
                  {isBusy && !isViewing ? <Loader2 className="w-4 h-4 animate-spin text-foreground" /> : <MoreVertical className="w-4 h-4 text-foreground" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-card border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] p-1.5 z-50"
              >
                {item.item_type !== "link" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload() }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none">
                    <Download className="w-4 h-4 text-[#FFD600]" /> Download
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item) }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none">
                  <Pencil className="w-4 h-4 text-[#00C853]" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(item) }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-2 py-1.5 rounded-[0.5rem] outline-none">
                  <FolderInput className="w-4 h-4 text-[#FF6B00]" /> Move
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-muted my-1" />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete() }} className="flex items-center gap-2 cursor-pointer font-sans text-[13px] font-medium text-[#FF3B30] focus:bg-[#FF3B30] focus:text-white px-2 py-1.5 rounded-[0.5rem] outline-none transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <h3 className="font-heading font-bold text-[15px] text-foreground truncate mb-1" title={isLink ? (item.title ?? "") : item.files?.filename}>
          {isLink ? (item.title || "Untitled Link") : (item.files?.filename || "Unknown File")}
        </h3>
        <div className="flex items-center justify-between mt-1">
          {isLink ? (
            <span className="font-mono text-[12px] font-medium text-muted-foreground truncate max-w-[60%] flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              {linkDomain}
            </span>
          ) : (
            <span className="font-mono text-[12px] font-medium text-muted-foreground">
              {formatBytes(item.files?.size_bytes ?? 0)}
            </span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground/70">{formatDate(item.created_at)}</span>
        </div>
        <div className="flex items-center mt-2.5 gap-1.5 overflow-hidden">
          <Folder className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
          <span className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider truncate">
            {pathString}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-[100px] border-[1.5px] border-foreground bg-background font-mono text-[11px] font-medium text-muted-foreground shadow-[2px_2px_0px_black]">
                #{tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2.5 py-0.5 rounded-[100px] border-[1.5px] border-border bg-muted font-mono text-[11px] text-muted-foreground/70">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({
  trail,
  onNavigate,
}: {
  trail: VaultFolder[]
  onNavigate: (id: string | null) => void
}) {
  return (
    <nav className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] border-[1.5px] border-foreground bg-card shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-mono text-[12px] font-medium text-foreground"
      >
        <Home className="w-3.5 h-3.5" />
        Vault
      </button>
      {trail.map((folder, idx) => (
        <div key={folder.id} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70" />
          <button
            onClick={() => onNavigate(folder.id)}
            className={`px-2.5 py-1 rounded-[8px] border-[1.5px] font-mono text-[12px] font-medium transition-all ${idx === trail.length - 1
              ? "border-foreground bg-[#FFD600] shadow-[2px_2px_0px_black] text-foreground"
              : "border-foreground bg-card shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none text-foreground"
              }`}
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  )
}

// ─── Sidebar Folder Tree ──────────────────────────────────────────────────────
function SidebarFolderTree({
  folders,
  currentFolderId,
  onNavigate,
  activeDropZone,
  parentId = null,
  depth = 0,
}: {
  folders: VaultFolder[]
  currentFolderId: string | null
  onNavigate: (id: string | null) => void
  activeDropZone: string | null
  parentId?: string | null
  depth?: number
}) {
  const children = folders.filter((f) => f.parent_id === parentId)
  if (children.length === 0) return null

  return (
    <ul className="space-y-0.5">
      {children.map((folder) => {
        const isActive = currentFolderId === folder.id
        const isDropTarget = activeDropZone === folder.id
        const hasChildren = folders.some((f) => f.parent_id === folder.id)
        return (
          <li key={folder.id}>
            <button
              data-drop-target={folder.id}
              onClick={() => onNavigate(folder.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] transition-all text-left font-sans text-[13px] font-medium ${isDropTarget
                ? "bg-[#FFD600] border-[1.5px] border-foreground text-foreground shadow-[0px_0px_0px_3px_#FFD60088]"
                : isActive
                  ? "bg-[#FFD600] border-[1.5px] border-foreground text-foreground shadow-[2px_2px_0px_black]"
                  : "hover:bg-muted text-foreground"
                }`}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {isActive
                ? <FolderOpen className="w-4 h-4 shrink-0" />
                : <Folder className="w-4 h-4 shrink-0 text-muted-foreground" />}
              <span className="truncate">{folder.name}</span>
              {hasChildren && (
                <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-muted-foreground/70" />
              )}
            </button>
            {isActive && hasChildren && (
              <SidebarFolderTree
                folders={folders}
                currentFolderId={currentFolderId}
                onNavigate={onNavigate}
                activeDropZone={activeDropZone}
                parentId={folder.id}
                depth={depth + 1}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VaultPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const handleOpenWindow = useVaultWindowStore((state) => state.openWindow)
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false)
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<VaultItem | null>(null)

  // Drag and drop state
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null) // folder id or "root"
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const { isDragging: isDraggingFiles } = useDragAndDrop((files) => {
    setDroppedFiles(files)
    setUploadModalOpen(true)
  })

  // New states for Folder rename and Move operations
  const [renameFolderItem, setRenameFolderItem] = useState<VaultFolder | null>(null)
  const [moveItem, setMoveItem] = useState<{ type: "file" | "folder"; id: string } | null>(null)

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
        ...selectedItemIds.map(id => deleteVaultItem(id)),
        ...selectedFolderIds.map(id => deleteVaultFolder(id))
      ])
      toast.success("Deleted successfully", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["vaultItems"] })
      queryClient.invalidateQueries({ queryKey: ["vaultFolders"] })
      clearSelection()
    } catch (e: any) {
      toast.error("Failed to delete some items", { id: toastId })
    }
  }

  const queryClient = useQueryClient()

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: allFolders = [], isLoading: foldersLoading } = useQuery<VaultFolder[]>({
    queryKey: ["vaultFolders"],
    queryFn: async () => {
      const res = await fetch("/api/vault/folders")
      if (!res.ok) throw new Error("Failed to fetch folders")
      return (await res.json()).data
    },
  })

  const { data: vaultItems = [], isLoading: itemsLoading } = useQuery<VaultItem[]>({
    queryKey: ["vaultItems", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/vault/items?folder_id=${currentFolderId}`
        : "/api/vault/items"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch items")
      return (await res.json()).data
    },
  })

  // Extract unique communities the user's files are shared with
  const availableCommunities = useMemo(() => {
    const map = new Map<string, string>()
    vaultItems.forEach((item: any) => {
      if (item.community_vault_items && Array.isArray(item.community_vault_items)) {
        item.community_vault_items.forEach((cvi: any) => {
          if (cvi.communities?.name) {
            map.set(cvi.community_id, cvi.communities.name)
          }
        })
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [vaultItems])

  // Subfolders of the current level
  const visibleFolders = allFolders.filter(
    (f) => f.parent_id === currentFolderId
  )

  // Client-side search & community filter on items + folders
  const filteredItems = vaultItems.filter((item) => {
    let match = true;

    if (selectedCommunityFilter === "PERSONAL_ONLY") {
      const belongsToAnyComm = Array.isArray((item as any).community_vault_items) &&
        (item as any).community_vault_items.length > 0;
      if (belongsToAnyComm) match = false;
    } else if (selectedCommunityFilter) {
      const belongsToComm = Array.isArray((item as any).community_vault_items) &&
        (item as any).community_vault_items.some((cvi: any) => cvi.community_id === selectedCommunityFilter);
      if (!belongsToComm) match = false;
    }

    if (searchQuery.trim() && match) {
      const q = searchQuery.toLowerCase()
      const checksName = item.files?.filename?.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q)
      const checksTags = item.tags?.some((t: string) => t.toLowerCase().includes(q))
      if (!checksName && !checksTags) match = false;
    }

    if (!searchQuery.trim()) {
      if (item.folder_id !== currentFolderId) match = false;
    }

    return match;
  })

  const filteredFolders = visibleFolders.filter((f) => {
    return searchQuery.trim() ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  })

  const breadcrumb = buildBreadcrumb(allFolders, currentFolderId)

  const totalStorage = vaultItems.reduce((acc, item) => acc + (item.files?.size_bytes ?? 0), 0)

  // Quota is computed from all items across all folders — re-use root query for the sidebar bar
  const { data: rootItems = [] } = useQuery<VaultItem[]>({
    queryKey: ["vaultItems", null],         // always cached from the root fetch
    queryFn: async () => {
      const res = await fetch("/api/vault/items")
      if (!res.ok) throw new Error("Failed to fetch items")
      return (await res.json()).data
    },
    enabled: false,                         // only served from cache, root fetch populates it
  })

  const allStorageItems = currentFolderId ? rootItems : vaultItems
  const storageUsed = allStorageItems.reduce((acc, i) => acc + (i.files?.size_bytes ?? 0), 0)
  const storagePercentage = Math.min((storageUsed / (500 * 1024 * 1024)) * 100, 100)
  const storageColor = storagePercentage > 80 ? "bg-[#FF3B30]" : "bg-[#FF3CAC]"

  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: ["vaultItems", currentFolderId] })
  const invalidateFolders = () =>
    queryClient.invalidateQueries({ queryKey: ["vaultFolders"] })

  const navigate = (id: string | null) => {
    setCurrentFolderId(id)
    setSearchQuery("")
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleInternalMove = useCallback(async (type: "file" | "folder", id: string, targetFolderId: string | null) => {
    if (type === "folder" && id === targetFolderId) return // Cannot drop into itself
    setActiveDropZone(null)
    const toastId = toast.loading(`Moving ${type}…`)
    try {
      if (type === "file") {
        await updateVaultItem(id, { folder_id: targetFolderId })
      } else {
        await updateVaultFolder(id, { parent_id: targetFolderId })
      }
      toast.success(`${type === "file" ? "File" : "Folder"} moved!`, { id: toastId })
      if (type === "file") {
        queryClient.invalidateQueries({ queryKey: ["vaultItems"] })
      } else {
        queryClient.invalidateQueries({ queryKey: ["vaultFolders"] })
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to move", { id: toastId })
    }
  }, [queryClient])

  const isLoading = foldersLoading || itemsLoading
  const isEmpty = filteredFolders.length === 0 && filteredItems.length === 0 && !isLoading

  return (
    <>
      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); setDroppedFiles([]) }}
        onUploadComplete={invalidateItems}
        currentFolderId={currentFolderId}
        initialFiles={droppedFiles}
      />

      <AddLinkModal
        isOpen={addLinkModalOpen}
        onClose={() => setAddLinkModalOpen(false)}
        onAdded={invalidateItems}
        currentFolderId={currentFolderId}
      />

      <NewFolderModal
        isOpen={newFolderModalOpen || !!renameFolderItem}
        onClose={() => { setNewFolderModalOpen(false); setRenameFolderItem(null); }}
        onCreated={invalidateFolders}
        parentId={currentFolderId}
      />

      <MoveModal
        isOpen={!!moveItem}
        onClose={() => setMoveItem(null)}
        onMoved={() => { invalidateFolders(); invalidateItems(); }}
        folders={allFolders}
        currentFolderId={currentFolderId}
        itemType={moveItem?.type ?? null}
        itemId={moveItem?.id ?? null}
      />

      {/* Edit Modal — key forces fresh mount per file */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null) }}>
        {editItem && (
          <EditModal
            key={editItem.id}
            item={editItem}
            onClose={() => setEditItem(null)}
            onSaved={invalidateItems}
          />
        )}
      </Dialog>

      <div className={`flex h-full w-full relative transition-all duration-200 ${isDraggingFiles ? 'ring-[3px] ring-inset ring-[#0057FF] rounded-[1rem]' : ''}`}>
        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-[220px] bg-background border-r-[2px] border-foreground flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b-[2px] border-foreground">
            <h2 className="font-heading font-extrabold text-[16px] text-foreground">MY VAULT</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Root button */}
            <button
              data-drop-target="root"
              onClick={() => navigate(null)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] transition-all text-left font-sans text-[13px] font-medium ${activeDropZone === "root"
                ? "bg-[#FFD600] border-[1.5px] border-foreground text-foreground shadow-[0px_0px_0px_3px_#FFD60088]"
                : currentFolderId === null
                  ? "bg-[#FFD600] border-[1.5px] border-foreground text-foreground shadow-[2px_2px_0px_black]"
                  : "hover:bg-muted text-foreground"
                }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>All Files</span>
            </button>

            {foldersLoading ? (
              <div className="space-y-1 pt-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-7 bg-muted rounded-[6px] animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {allFolders.length > 0 && (
                  <div className="font-mono text-[10px] text-muted-foreground/70 px-2 pt-3 pb-1 uppercase tracking-wider">
                    Folders
                  </div>
                )}
                <SidebarFolderTree
                  folders={allFolders}
                  currentFolderId={currentFolderId}
                  onNavigate={navigate}
                  activeDropZone={activeDropZone}
                />
              </>
            )}
          </div>

          {/* Storage quota */}
          <div className="p-4 border-t-[2px] border-foreground bg-card">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-muted-foreground">STORAGE</span>
              <span className="font-mono text-[10px] font-bold text-foreground">
                {formatBytes(storageUsed)} / 500 MB
              </span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden border-[1.5px] border-foreground">
              <div
                className={`h-full transition-all ${storageColor}`}
                style={{ width: `${Math.max(storagePercentage, 2)}%` }}
              />
            </div>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 bg-card flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="p-6 border-b-[2px] border-border bg-card z-10 shrink-0 space-y-4">
            {/* Breadcrumb */}
            <Breadcrumb trail={breadcrumb} onNavigate={navigate} />

            {/* Actions row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 max-w-sm min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or #tag…"
                  className="w-full pl-9 pr-8 py-2.5 rounded-[0.75rem] border-[2px] border-foreground bg-background font-sans text-[14px] text-foreground placeholder:text-muted-foreground/70 placeholder:font-mono outline-none focus:bg-card focus:shadow-[4px_4px_0px_black] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Community Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 rounded-[0.75rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all font-heading font-bold text-[13px] text-foreground flex items-center gap-2">
                    {selectedCommunityFilter ?
                      <><Filter className="w-4 h-4 text-[#0057FF]" /> <span className="max-w-[120px] truncate">{selectedCommunityFilter === "PERSONAL_ONLY" ? "Personal Vault Only" : availableCommunities.find(c => c.id === selectedCommunityFilter)?.name}</span></>
                      :
                      <><Filter className="w-4 h-4" /> All Communities</>
                    }
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] p-2 z-50">
                  <DropdownMenuItem onClick={() => setSelectedCommunityFilter(null)} className="cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-3 py-2 rounded-[0.5rem] mb-1 outline-none">
                    All Communities
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedCommunityFilter("PERSONAL_ONLY")} className="cursor-pointer font-sans text-[13px] font-medium focus:bg-[rgba(255,59,48,0.1)] text-[#FF3B30] px-3 py-2 rounded-[0.5rem] mb-1 outline-none">
                    Personal Vault Only
                  </DropdownMenuItem>
                  {availableCommunities.length > 0 && <DropdownMenuSeparator className="bg-muted" />}
                  {availableCommunities.map(c => (
                    <DropdownMenuItem key={c.id} onClick={() => setSelectedCommunityFilter(c.id)} className="cursor-pointer font-sans text-[13px] font-medium focus:bg-muted px-3 py-2 rounded-[0.5rem] outline-none">
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                  {availableCommunities.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-muted-foreground/70 font-mono italic">No shared items found.</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* New Folder */}
              <button
                onClick={() => setNewFolderModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[4px_4px_0px_black] font-heading font-bold text-[13px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all shrink-0"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>

              {/* Add Link */}
              <button
                onClick={() => setAddLinkModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-[#0057FF] shadow-[4px_4px_0px_black] font-heading font-bold text-[13px] text-white hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all shrink-0"
              >
                <Link2 className="w-4 h-4" />
                Add Link
              </button>

              {/* Upload */}
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[0.875rem] border-[3px] border-foreground bg-[#FFD600] shadow-[5px_5px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[5px] hover:translate-y-[5px] hover:shadow-none transition-all shrink-0"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>

          {/* Grid content */}
          <div className="flex-1 p-6 overflow-y-auto bg-card">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-background border-[2px] border-border rounded-[24px] h-[140px]"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>
            ) : isEmpty ? (
              /* Empty state */
              <div className="w-full min-h-[400px] border-[2px] border-dashed border-foreground bg-background rounded-[24px] flex flex-col items-center justify-center text-center p-8 gap-4">
                <div className="relative w-20 h-20">
                  <div className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-[#0057FF] border-[1.5px] border-foreground" />
                  <div className="absolute -bottom-2 -left-3 w-4 h-4 bg-[#FF3CAC] border-[1.5px] border-foreground rotate-45" />
                  <div className="w-20 h-20 bg-card rounded-[16px] rotate-[-6deg] flex items-center justify-center border-[2px] border-foreground shadow-[4px_4px_0px_black]">
                    {currentFolderId
                      ? <FolderOpen className="w-10 h-10 text-[#FFD600]" />
                      : <Sparkles className="w-10 h-10 text-[#FF3CAC]" />}
                  </div>
                </div>
                <h3 className="font-heading font-extrabold text-[22px] text-foreground">
                  {currentFolderId ? "This folder is empty" : "Your Vault is Empty"}
                </h3>
                <p className="font-sans text-[15px] text-muted-foreground max-w-xs">
                  {currentFolderId
                    ? "Upload a file here or create a sub-folder to organise your work."
                    : "Start securing your documents and resources. Upload your first file now."}
                </p>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <button
                    onClick={() => setNewFolderModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[4px_4px_0px_black] font-heading font-bold text-[14px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
                  >
                    <FolderPlus className="w-4 h-4" />
                    New Folder
                  </button>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-[0.875rem] border-[3px] border-foreground bg-[#FFD600] shadow-[5px_5px_0px_black] font-heading font-bold text-[15px] text-foreground hover:translate-x-[5px] hover:translate-y-[5px] hover:shadow-none transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                </div>
              </div>
            ) : searchQuery && filteredFolders.length === 0 && filteredItems.length === 0 ? (
              /* No search results */
              <div className="w-full min-h-[400px] border-[2px] border-dashed border-foreground bg-background rounded-[24px] flex flex-col items-center justify-center text-center p-8 gap-4">
                <div className="w-16 h-16 bg-card rounded-[16px] flex items-center justify-center border-[2px] border-foreground shadow-[4px_4px_0px_black]">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-heading font-extrabold text-[22px] text-foreground">No matches found</h3>
                <p className="font-sans text-[14px] text-muted-foreground">
                  Nothing matches &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-5 py-2.5 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                layout
              >
                <AnimatePresence>
                  {/* Folders first */}
                  {filteredFolders.map((folder) => (
                    <FolderCard
                      key={`folder-${folder.id}`}
                      folder={folder}
                      isDropTarget={activeDropZone === folder.id}
                      onClick={() => navigate(folder.id)}
                      onRename={(f) => {
                        // We can quickly implement a native prompt or use NewFolderModal
                        const newName = window.prompt("Enter new folder name:", f.name)
                        if (newName && newName.trim() !== f.name) {
                          updateVaultFolder(f.id, { name: newName.trim() }).then(() => invalidateFolders())
                        }
                      }}
                      onMove={(f) => setMoveItem({ type: "folder", id: f.id })}
                      onDelete={invalidateFolders}
                      isSelected={selectedFolderIds.includes(folder.id)}
                      onToggle={toggleFolder}
                      selectionMode={selectedItemIds.length > 0 || selectedFolderIds.length > 0}
                      onDragOver={setActiveDropZone}
                      onDropFile={handleInternalMove}
                    />
                  ))}

                  {/* Separator label if both exist */}
                  {filteredFolders.length > 0 && filteredItems.length > 0 && (
                    <motion.div
                      key="file-separator"
                      className="col-span-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-[2px] flex-1 bg-muted" />
                        <span className="font-mono text-[11px] text-muted-foreground/70 uppercase tracking-wider">Files</span>
                        <div className="h-[2px] flex-1 bg-muted" />
                      </div>
                    </motion.div>
                  )}

                  {/* File cards */}
                  {filteredItems.map((item) => (
                    <FileCard
                      key={`file-${item.id}`}
                      item={item}
                      folders={allFolders}
                      onDelete={invalidateItems}
                      onEdit={(i) => setEditItem(i)}
                      onMove={(i) => setMoveItem({ type: "file", id: i.id })}
                      onDropFile={handleInternalMove}
                      onDragOver={(id) => setActiveDropZone(id)}
                      onOpenWindow={handleOpenWindow}
                      isSelected={selectedItemIds.includes(item.id)}
                      onToggle={toggleItem}
                      selectionMode={selectedItemIds.length > 0 || selectedFolderIds.length > 0}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Result count during search */}
            {searchQuery && (filteredFolders.length > 0 || filteredItems.length > 0) && (
              <p className="font-mono text-[11px] text-muted-foreground/70 mt-4">
                {filteredFolders.length + filteredItems.length} result
                {filteredFolders.length + filteredItems.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bulk Action Bar ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {(selectedItemIds.length > 0 || selectedFolderIds.length > 0) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] px-6 py-3"
          >
            <span className="font-heading font-extrabold text-[15px] text-foreground">
              {selectedItemIds.length + selectedFolderIds.length} selected
            </span>
            <div className="w-[2px] h-5 bg-muted" />
            <button
              onClick={clearSelection}
              className="font-heading font-bold text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-[1rem] border-[2px] border-foreground shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all font-heading font-bold text-[13px]"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedItemIds.length + selectedFolderIds.length} item{selectedItemIds.length + selectedFolderIds.length !== 1 ? "s" : ""}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  )
}
