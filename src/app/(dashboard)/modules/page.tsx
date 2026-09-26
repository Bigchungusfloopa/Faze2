"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Search, Plus, Loader2, Users, Globe, Lock, Shield, User, Clock, Star } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createModule } from "@/actions/modules"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// --- Types ---
interface Community {
  id: string
  name: string
  description: string
  type: string
  member_count: number
  banner_url?: string
  membership?: { role: string } | null
}

// --- Zod Schema ---
const createCommunitySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50, "Name is too long"),
  description: z.string().max(200, "Description must be under 200 characters").optional(),
  type: z.enum(["Public", "Private"])
})
type CreateCommunityValues = z.infer<typeof createCommunitySchema>

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const { data: communities = [], isLoading } = useQuery<Community[]>({
    queryKey: ["communities", "modules", searchQuery],
    queryFn: async () => {
      const url = searchQuery
        ? `/api/communities?q=${encodeURIComponent(searchQuery)}`
        : `/api/communities`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch communities")
      return res.json()
    }
  })

  return (
    <div className="w-full max-w-none mx-auto p-4 md:p-8 space-y-8 pb-32">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 border-[3px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black] font-sans text-[16px] focus-visible:ring-0 focus-visible:shadow-[6px_6px_0px_black] transition-all bg-card"
          />
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="shrink-0 h-14 px-6 md:px-8 rounded-[1rem] border-[3px] border-foreground bg-[#FFD600] shadow-[6px_6px_0px_black] font-heading font-bold text-[16px] text-foreground hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Community
        </button>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-foreground" />
        </div>
      ) : communities.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 mx-auto rounded-[24px] border-[3px] border-foreground bg-background flex items-center justify-center -rotate-6 shadow-[6px_6px_0px_black]">
            <Search className="w-10 h-10 text-foreground" />
          </div>
          <h2 className="font-heading font-extrabold text-[28px] text-foreground mt-6">No communities found</h2>
          <p className="font-sans text-[16px] text-muted-foreground">Try adjusting your search or create a new one.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {(() => {
            const ownedCommunities = communities.filter(c => c.membership && c.membership.role === 'owner')
            const joinedCommunities = communities.filter(c => c.membership && (c.membership.role === 'peer' || c.membership.role === 'curator'))
            const discoverCommunities = communities.filter(c => !c.membership || c.membership.role === 'pending')

            return (
              <>
                {ownedCommunities.length > 0 && (
                  <section className="space-y-6">
                    <h2 className="font-heading font-extrabold text-[24px] text-foreground flex items-center gap-2">
                      <div className="w-4 h-4 rounded-[4px] bg-[#0057FF] border-[1.5px] border-foreground shadow-[1px_1px_0px_black]" />
                      Owned Communities
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {ownedCommunities.map((c, i) => (
                        <CommunityCard key={c.id} community={c} index={i} />
                      ))}
                    </div>
                  </section>
                )}

                {joinedCommunities.length > 0 && (
                  <section className="space-y-6">
                    <h2 className="font-heading font-extrabold text-[24px] text-foreground flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#FFD600] border-[1.5px] border-foreground shadow-[1px_1px_0px_black]" />
                      Joined Communities
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {joinedCommunities.map((c, i) => (
                        <CommunityCard key={c.id} community={c} index={i} />
                      ))}
                    </div>
                  </section>
                )}

                {discoverCommunities.length > 0 && (
                  <section className="space-y-6">
                    <h2 className="font-heading font-extrabold text-[24px] text-foreground flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-[#FF3CAC] border-[1.5px] border-foreground shadow-[1px_1px_0px_black]" />
                      Discover
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {discoverCommunities.map((c, i) => (
                        <CommunityCard key={c.id} community={c} index={i} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Create Modal */}
      <CreateCommunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

function CommunityCard({ community, index }: { community: Community, index: number }) {
  return (
    <Link href={`/modules/${community.id}`} className="block h-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.04 }}
        className="group flex flex-col h-full bg-card border-[3px] border-foreground rounded-[1.5rem] shadow-[6px_6px_0px_black] hover:translate-x-[6px] hover:translate-y-[6px] hover:shadow-none transition-all overflow-hidden cursor-pointer"
      >
        <div className="h-32 bg-background border-b-[3px] border-foreground relative flex items-center justify-center overflow-hidden">
          {/* Abstract Memphis pattern representation */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(var(--foreground) 2.5px, transparent 2.5px)', backgroundSize: '20px 20px' }} />
          {community.banner_url ? (
            <img src={community.banner_url} alt="banner" className="w-full h-full object-cover relative z-10" />
          ) : (
            <h3 className="font-heading font-extrabold text-6xl text-foreground opacity-20 relative z-10 select-none">
              {community.name[0]?.toUpperCase()}
            </h3>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-3 gap-2">
            <h3 className="font-heading font-bold text-[22px] text-foreground leading-tight line-clamp-2">
              {community.name}
            </h3>
            <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-[100px] border-[1.5px] border-foreground shadow-[2px_2px_0px_black] font-mono text-[11px] font-bold tracking-wide ${community.type === 'Public' ? 'bg-[#00C853] text-white' : 'bg-[#FF6B00] text-white'}`}>
              {community.type === 'Public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {community.type.toUpperCase()}
            </span>
          </div>

          {community.membership && (
            <div className="mb-3">
              {community.membership.role === 'owner' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] border-[2px] border-foreground shadow-[3px_3px_0px_black] font-mono text-[12px] font-bold tracking-wide bg-[#0057FF] text-white">
                  <Shield className="w-4 h-4" />
                  OWNER
                </span>
              ) : community.membership.role === 'curator' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[100px] border-[1.5px] border-foreground shadow-[2px_2px_0px_black] font-mono text-[11px] font-bold tracking-wide bg-[#FF3CAC] text-white">
                  <Star className="w-3.5 h-3.5" />
                  CURATOR
                </span>
              ) : community.membership.role === 'pending' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[100px] border-[1.5px] border-foreground shadow-[2px_2px_0px_black] font-mono text-[11px] font-bold tracking-wide bg-muted text-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  PENDING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[100px] border-[1.5px] border-foreground shadow-[2px_2px_0px_black] font-mono text-[11px] font-bold tracking-wide bg-[#FFD600] text-foreground">
                  <User className="w-3.5 h-3.5" />
                  PEER
                </span>
              )}
            </div>
          )}

          <p className="font-sans text-[15px] leading-relaxed text-muted-foreground line-clamp-2 mb-6 flex-1">
            {community.description || "No description provided."}
          </p>

          <div className="flex items-center justify-between pt-5 border-t-[2px] border-dashed border-border">
            <div className="flex items-center gap-2 font-mono text-[13px] text-foreground">
              <div className="w-8 h-8 rounded-[8px] bg-muted border-[1.5px] border-foreground flex items-center justify-center">
                <Users className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-bold">{community.member_count}</span> member{community.member_count !== 1 ? 's' : ''}
            </div>
            <div className="px-5 py-2 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[14px] text-foreground group-hover:bg-[#FFD600] group-hover:translate-x-[3px] group-hover:translate-y-[3px] group-hover:shadow-none transition-all">
              View
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

function CreateCommunityModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCommunityValues>({
    resolver: zodResolver(createCommunitySchema),
    defaultValues: {
      type: "Public",
      name: "",
      description: ""
    }
  })

  const onSubmit = async (values: CreateCommunityValues) => {
    setIsCreating(true)
    const toastId = toast.loading("Creating community...")
    try {
      await createModule(values)
      toast.success("Community created!", { id: toastId })
      queryClient.invalidateQueries({ queryKey: ["communities"] })
      reset()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Failed to create community", { id: toastId })
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] max-w-md p-8">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold text-[24px] text-foreground">
            Create a Community
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider font-bold">
              Community Name
            </Label>
            <Input
              {...register("name")}
              placeholder="e.g. CS101 Study Group"
              className={`border-[2px] ${errors.name ? 'border-[#FF3B30]' : 'border-foreground'} rounded-[0.75rem] font-sans text-[15px] h-12 shadow-[2px_2px_0px_black] focus-visible:ring-0 focus-visible:border-foreground`}
            />
            {errors.name && <p className="font-sans text-[12px] text-[#FF3B30] mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider font-bold">
              Description (Optional)
            </Label>
            <Input
              {...register("description")}
              placeholder="What is this community about?"
              className={`border-[2px] ${errors.description ? 'border-[#FF3B30]' : 'border-foreground'} rounded-[0.75rem] font-sans text-[15px] h-12 shadow-[2px_2px_0px_black] focus-visible:ring-0 focus-visible:border-foreground`}
            />
            {errors.description && <p className="font-sans text-[12px] text-[#FF3B30] mt-1 font-medium">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider font-bold">
              Privacy Type
            </Label>
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer relative group">
                <input type="radio" value="Public" {...register("type")} className="peer sr-only" />
                <div className="px-4 py-4 border-[2px] border-border rounded-[1rem] peer-checked:border-foreground peer-checked:bg-background peer-checked:shadow-[4px_4px_0px_black] transition-all text-center group-hover:border-foreground">
                  <div className="font-heading font-bold text-[16px] text-foreground">Public</div>
                  <div className="font-sans text-[13px] text-muted-foreground mt-1">Anyone can join</div>
                </div>
              </label>

              <label className="flex-1 cursor-pointer relative group">
                <input type="radio" value="Private" {...register("type")} className="peer sr-only" />
                <div className="px-4 py-4 border-[2px] border-border rounded-[1rem] peer-checked:border-foreground peer-checked:bg-background peer-checked:shadow-[4px_4px_0px_black] transition-all text-center group-hover:border-foreground">
                  <div className="font-heading font-bold text-[16px] text-foreground">Private</div>
                  <div className="font-sans text-[13px] text-muted-foreground mt-1">Requires approval</div>
                </div>
              </label>
            </div>
            {errors.type && <p className="font-sans text-[12px] text-[#FF3B30] mt-1 font-medium">{errors.type.message}</p>}
          </div>

          <DialogFooter className="pt-6 gap-3 flex-col sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-6 py-3 rounded-[0.875rem] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] font-heading font-bold text-[15px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="w-full sm:w-auto px-6 py-3 rounded-[0.875rem] border-[2px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[15px] text-foreground hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {isCreating ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
