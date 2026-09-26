import { create } from "zustand"
import { toast } from "sonner"

export type VaultWindowType = "pdf" | "image" | "youtube" | "drive_file" | "drive_folder"

export interface VaultWindow {
  id: string
  type: VaultWindowType
  url: string
  title: string
  zIndex: number
  isMinimized?: boolean
}

export type VaultWindowConfig = Omit<VaultWindow, "id" | "zIndex">

interface VaultWindowState {
  windows: VaultWindow[]
  openWindow: (config: VaultWindowConfig) => void
  closeWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
  focusWindow: (id: string) => void
}

export const useVaultWindowStore = create<VaultWindowState>((set) => ({
  windows: [],

  openWindow: (config) => {
    set((state) => {
      if (state.windows.length >= 7) {
        toast.error("Maximum 7 windows allowed. Close some to open new ones.")
        return state
      }

      const maxZ = state.windows.length > 0
        ? Math.max(...state.windows.map((w) => w.zIndex))
        : 100

      return {
        windows: [
          ...state.windows,
          {
            ...config,
            id: Math.random().toString(36).slice(2, 11),
            zIndex: Math.max(100, maxZ) + 1,
          },
        ],
      }
    })
  },

  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }))
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w
      ),
    }))
  },

  restoreWindow: (id) => {
    set((state) => {
      const maxZ = Math.max(100, ...state.windows.map((w) => w.zIndex))
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: maxZ + 1 } : w
        ),
      }
    })
  },

  focusWindow: (id) => {
    set((state) => {
      const maxZ = Math.max(100, ...state.windows.map((w) => w.zIndex))
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, zIndex: maxZ + 1 } : w
        ),
      }
    })
  },
}))
