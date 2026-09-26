"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useDragControls, useMotionValue } from "framer-motion"
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Minus,
  PlayCircle,
  X,
} from "lucide-react"
import { useVaultWindowStore, type VaultWindow } from "@/lib/stores/useVaultWindowStore"

type Bounds = {
  width: number
  height: number
}

function useElementBounds(ref: React.RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const update = () => {
      const rect = node.getBoundingClientRect()
      setBounds({ width: rect.width, height: rect.height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return bounds
}

function getWindowIcon(win: VaultWindow, className = "w-5 h-5") {
  if (win.type === "image") return <ImageIcon className={`${className} text-foreground`} />
  if (win.type === "youtube") return <PlayCircle className={`${className} text-[#FF3B30]`} />
  if (win.type === "drive_file" || win.type === "drive_folder") {
    return (
      <svg viewBox="0 0 87.3 78" className={className} aria-label="Google Drive">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 52H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5C.4 48.9 0 50.45 0 52h27.5z" fill="#00ac47" />
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60l5.85 11.5z" fill="#ea4335" />
        <path d="M43.65 25L57.4 0c-1.55 0-3.1.4-4.5 1.2L29.9 0 16.15 25z" fill="#00832d" />
        <path d="M60 52H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.55 0 3.1-.4 4.5-1.2z" fill="#2684fc" />
        <path d="M73.4 26.5L59.65 2.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 60 52h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
      </svg>
    )
  }

  return <FileText className={`${className} text-foreground`} />
}

function VaultWindowRenderer({
  win,
  index,
  bounds,
}: {
  win: VaultWindow
  index: number
  bounds: Bounds
}) {
  const closeWindow = useVaultWindowStore((state) => state.closeWindow)
  const focusWindow = useVaultWindowStore((state) => state.focusWindow)
  const minimizeWindow = useVaultWindowStore((state) => state.minimizeWindow)

  const isImage = win.type === "image"
  const isPdf = win.type === "pdf"
  const isYoutube = win.type === "youtube"
  const isDriveFile = win.type === "drive_file"
  const isDriveFolder = win.type === "drive_folder"

  const dragControls = useDragControls()
  const x = useMotionValue(72 + index * 28)
  const y = useMotionValue(48 + index * 24)

  const [scale, setScale] = useState(1)
  const [size, setSize] = useState({ w: 900, h: 600 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const resizeRef = useRef<{
    startX: number
    startY: number
    startW: number
    startH: number
    startXVal: number
    startYVal: number
  } | null>(null)

  const minW = Math.min(480, Math.max(280, bounds.width || 480))
  const minH = Math.min(320, Math.max(220, bounds.height || 320))
  const boundedSize = {
    w: bounds.width ? Math.min(Math.max(size.w, minW), bounds.width) : size.w,
    h: bounds.height ? Math.min(Math.max(size.h, minH), bounds.height) : size.h,
  }
  const dragConstraints = {
    left: 0,
    top: 0,
    right: Math.max(0, bounds.width - boundedSize.w),
    bottom: Math.max(0, bounds.height - boundedSize.h),
  }

  useEffect(() => {
    if (!bounds.width || !bounds.height) return
    x.set(Math.min(Math.max(0, x.get()), Math.max(0, bounds.width - boundedSize.w)))
    y.set(Math.min(Math.max(0, y.get()), Math.max(0, bounds.height - boundedSize.h)))
  }, [bounds.width, bounds.height, boundedSize.w, boundedSize.h, x, y])

  useEffect(() => {
    if (!isDragging) return

    const stopDragging = () => setIsDragging(false)
    window.addEventListener("pointerup", stopDragging)
    window.addEventListener("pointercancel", stopDragging)
    window.addEventListener("blur", stopDragging)

    return () => {
      window.removeEventListener("pointerup", stopDragging)
      window.removeEventListener("pointercancel", stopDragging)
      window.removeEventListener("blur", stopDragging)
    }
  }, [isDragging])

  const startHeaderDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isFullscreen) return
    if ((e.target as HTMLElement).closest("[data-window-control]")) return

    e.preventDefault()
    e.stopPropagation()
    focusWindow(win.id)
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragControls.start(e)
  }

  const stopHeaderDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!isImage) return
    e.preventDefault()
    setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.25), 5))
  }

  const onResizeStart = (e: React.MouseEvent, direction: "se" | "sw") => {
    e.preventDefault()
    e.stopPropagation()

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXVal: x.get(),
      startYVal: y.get(),
    }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return

      const dw = ev.clientX - resizeRef.current.startX
      const dh = ev.clientY - resizeRef.current.startY
      const startRight = resizeRef.current.startXVal + resizeRef.current.startW
      const maxH = Math.max(minH, bounds.height - resizeRef.current.startYVal)
      const newH = Math.min(Math.max(minH, resizeRef.current.startH + dh), maxH)

      if (direction === "se") {
        const maxW = Math.max(minW, bounds.width - resizeRef.current.startXVal)
        setSize({
          w: Math.min(Math.max(minW, resizeRef.current.startW + dw), maxW),
          h: newH,
        })
        return
      }

      let newX = Math.min(Math.max(0, resizeRef.current.startXVal + dw), startRight - minW)
      let newW = startRight - newX

      if (newW < minW) {
        newW = minW
        newX = Math.max(0, startRight - minW)
      }

      x.set(newX)
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

  const fullscreenStyle = isFullscreen
    ? { width: "100%", height: "100%", borderRadius: 0, border: "none" }
    : { width: boundedSize.w, height: boundedSize.h }

  return (
    <motion.div
      drag={!isFullscreen}
      dragMomentum={false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={dragConstraints}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      onMouseDownCapture={() => focusWindow(win.id)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: win.isMinimized ? 0 : 1,
        scale: win.isMinimized ? 0.8 : 1,
        pointerEvents: win.isMinimized ? "none" : "auto",
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{
        x: isFullscreen ? 0 : x,
        y: isFullscreen ? 0 : y,
        zIndex: win.zIndex,
        position: "absolute",
        top: 0,
        left: 0,
        ...fullscreenStyle,
        maxWidth: "none",
        transition: isFullscreen ? "all 0.2s ease" : "none",
      }}
      className={`pointer-events-auto viewer-chrome bg-black border-[3px] border-black p-0 flex flex-col overflow-hidden ${isFullscreen ? "" : "rounded-[2rem] shadow-[8px_8px_0px_#FFD600]"}`}
    >
      <div
        onPointerDown={startHeaderDrag}
        onPointerUp={stopHeaderDrag}
        onPointerCancel={stopHeaderDrag}
        onLostPointerCapture={() => setIsDragging(false)}
        className="flex items-center justify-between px-5 py-3 border-b-[2px] border-[#222] shrink-0 select-none cursor-move"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="viewer-file-icon w-7 h-7 bg-[#FFD600] rounded-[7px] border-[2px] border-black flex items-center justify-center shrink-0">
            {getWindowIcon(win, "w-3.5 h-3.5")}
          </div>
          <span className="font-heading font-bold text-[14px] text-white truncate">{win.title}</span>
        </div>

        <div
          data-window-control
          className="flex items-center gap-2 shrink-0 cursor-default"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isImage && (
            <div className="flex items-center gap-1 bg-[#1A1A1A] border-[2px] border-[#333] rounded-[0.75rem] px-1 py-1">
              <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.25))} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom out">-</button>
              <button onClick={() => setScale(1)} className="px-2 h-7 rounded-[6px] hover:bg-[#333] font-mono text-[11px] text-[#999] transition-all min-w-[42px] text-center" title="Reset zoom">{Math.round(scale * 100)}%</button>
              <button onClick={() => setScale((s) => Math.min(s + 0.25, 5))} className="w-7 h-7 rounded-[6px] hover:bg-[#333] flex items-center justify-center text-white font-bold text-lg leading-none transition-all" title="Zoom in">+</button>
            </div>
          )}

          <button onClick={() => minimizeWindow(win.id)} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title="Minimize">
            <Minus className="w-3.5 h-3.5 text-white" />
          </button>
          <button onClick={() => setIsFullscreen((f) => !f)} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title={isFullscreen ? "Restore" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
          </button>
          <button onClick={() => window.open(win.url, "_blank", "noopener,noreferrer")} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#333] flex items-center justify-center transition-all" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5 text-white" />
          </button>
          {(isImage || isPdf) && (
            <button
              onClick={() => {
                const a = document.createElement("a")
                a.href = win.url
                a.download = win.title
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
              }}
              className="px-3 py-1.5 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#222] text-white font-heading font-bold text-[12px] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}
          <button onClick={() => closeWindow(win.id)} className="w-8 h-8 rounded-[0.75rem] border-[2px] border-[#333] bg-[#1A1A1A] hover:bg-[#FF3B30] flex items-center justify-center transition-all">
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center bg-[#111] relative cursor-default" onWheel={handleWheel} onMouseDown={(e) => e.stopPropagation()}>
        {isDragging && <div className="absolute inset-0 z-40 cursor-move bg-transparent" />}
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

export function VaultWindowManager() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const bounds = useElementBounds(workspaceRef)
  const windows = useVaultWindowStore((state) => state.windows)
  const closeWindow = useVaultWindowStore((state) => state.closeWindow)
  const focusWindow = useVaultWindowStore((state) => state.focusWindow)
  const restoreWindow = useVaultWindowStore((state) => state.restoreWindow)

  return (
    <div ref={workspaceRef} className="pointer-events-none fixed left-0 right-0 bottom-0 top-[64px] z-[180] overflow-hidden">
      <AnimatePresence>
        {windows.length > 0 && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="pointer-events-auto absolute left-6 top-1/2 -translate-y-1/2 z-[200] flex flex-col gap-3 bg-card border-[3px] border-foreground rounded-[1.5rem] shadow-[6px_6px_0px_black] p-3 max-h-[80vh] overflow-y-auto overflow-x-hidden group/dock transition-all duration-300"
          >
            {windows.map((win) => (
              <button
                key={`dock-${win.id}`}
                onClick={() => {
                  if (win.isMinimized) restoreWindow(win.id)
                  else focusWindow(win.id)
                }}
                title={win.title}
                className={`h-12 shrink-0 rounded-[12px] border-[2px] border-foreground flex items-center shadow-[3px_3px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all duration-300 relative group/btn w-12 group-hover/dock:w-[180px] ${win.isMinimized ? "bg-muted opacity-60" : "bg-background hover:bg-muted"}`}
              >
                <div className="w-11 h-11 flex items-center justify-center shrink-0">
                  {getWindowIcon(win)}
                </div>

                <div className="flex-1 text-left w-0 opacity-0 group-hover/dock:w-auto group-hover/dock:opacity-100 group-hover/dock:pr-3 transition-all duration-300 overflow-hidden whitespace-nowrap">
                  <span className="font-heading font-bold text-[13px] text-foreground block truncate">
                    {win.title}
                  </span>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); closeWindow(win.id) }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-[#FF3B30] border-[1.5px] border-foreground rounded-full opacity-0 group-hover/btn:opacity-100 flex items-center justify-center transition-opacity z-10"
                >
                  <X className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {windows.map((win, index) => (
          <VaultWindowRenderer key={win.id} win={win} index={index} bounds={bounds} />
        ))}
      </AnimatePresence>
    </div>
  )
}
