"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { FileText, Link as LinkIcon, Users, Building, Edit2, Check, X, Plus, Clock, Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

// Types
interface ProfileStats {
  vaultFileCount: number
  vaultLinkCount: number
  communitiesJoined: number
  communitiesOwned: number
  recentItems: { id: string; title: string; item_type: string; created_at: string; url?: string; files?: { filename: string } }[]
}

interface UserProfile {
  id: string
  name: string
  email: string
  college: string
  stream: string
  course: string
  year: string
  tags: string[]
  profile_pic: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [currentTag, setCurrentTag] = useState("")
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    const toastId = toast.loading("Uploading profile picture...")
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to upload avatar")

      setProfile(prev => prev ? { ...prev, profile_pic: data.profile_pic } : null)
      toast.success("Profile picture updated successfully!", { id: toastId })
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // Fetch Profile Stats
  const { data: stats, isLoading: statsLoading } = useQuery<ProfileStats>({
    queryKey: ["profileStats"],
    queryFn: async () => {
      const res = await fetch("/api/profile/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  // Fetch User Profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

        let userRecord = data

        // If no record exists in public.users, create one on the fly (self-heal)
        if (!userRecord) {
          const fallbackData = {
            id: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
            email: user.email || "",
            profile_pic: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          }

          const { data: inserted } = await supabase
            .from("users")
            .upsert(fallbackData)
            .select()
            .maybeSingle()

          userRecord = inserted || fallbackData
        }

        const fullProfile: UserProfile = {
          id: user.id,
          name: userRecord.name || user.user_metadata?.full_name || user.user_metadata?.name || "User",
          email: user.email || userRecord.email || "",
          college: userRecord.college || "",
          stream: userRecord.stream || "",
          course: userRecord.course || "",
          year: userRecord.year || "",
          tags: userRecord.tags || [],
          profile_pic: userRecord.profile_pic || null,
        }

        setProfile(fullProfile)
        setEditForm(fullProfile)
      } catch (err) {
        console.error("Failed to load profile:", err)
      }
    }
    loadProfile()
  }, [supabase])

  // Mutation to update profile
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!profile?.id) throw new Error("No user ID")
      const { error } = await supabase
        .from("users")
        .update({
          name: updates.name,
          college: updates.college,
          stream: updates.stream,
          course: updates.course,
          year: updates.year,
          tags: updates.tags,
        })
        .eq("id", profile.id)

      if (error) throw error
      return updates
    },
    onSuccess: (updatedData) => {
      setProfile((prev) => prev ? { ...prev, ...updatedData } : null)
      setIsEditing(false)
    },
  })

  const handleSave = () => {
    updateProfileMutation.mutate(editForm)
  }

  const handleCancel = () => {
    setEditForm(profile || {})
    setIsEditing(false)
    setCurrentTag("")
  }

  const handleAddTag = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    if (!currentTag.trim()) return
    const tags = editForm.tags || []
    if (!tags.includes(currentTag.trim())) {
      setEditForm({ ...editForm, tags: [...tags, currentTag.trim()] })
    }
    setCurrentTag("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag(e)
    }
  }

  const removeTag = (tagToRemove: string) => {
    setEditForm({
      ...editForm,
      tags: (editForm.tags || []).filter((t) => t !== tagToRemove)
    })
  }

  if (!profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="w-8 h-8 border-4 border-foreground border-t-[#FFD600] rounded-full animate-spin" />
      </div>
    )
  }

  const initials = profile.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ME"

  return (
    <div className="p-6 lg:p-12 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="font-heading font-extrabold text-[36px] md:text-[48px] text-foreground tracking-tight uppercase leading-none">
          Your Profile
        </h1>
        <p className="font-sans font-medium text-[16px] text-muted-foreground mt-2">
          Manage your personal details and view your activity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT PANEL - Identity Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-5 flex flex-col gap-6"
        >
          <div className="bg-card border-[3px] border-foreground rounded-[24px] shadow-[6px_6px_0px_black] p-8 overflow-hidden relative">
            {/* Decorative bg shapes */}
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 rounded-full border-[2px] border-foreground bg-[#FFD600]/20 pointer-events-none" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-[3px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] overflow-hidden flex items-center justify-center text-[36px] font-mono font-bold relative">
                  {profile.profile_pic ? (
                    <img src={profile.profile_pic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    initials
                  )}
                  {isEditing && (
                    <label className="absolute inset-0 bg-foreground/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-[10px] font-bold">
                      {isUploadingAvatar ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <Camera className="w-5 h-5 mb-1" />
                          Change
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                    </label>
                  )}
                </div>
              </div>
              
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2.5 rounded-[12px] border-[2px] border-foreground bg-background hover:bg-[#FFD600] hover:shadow-[3px_3px_0px_black] hover:-translate-y-1 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="p-2.5 rounded-[12px] border-[2px] border-foreground bg-[#FF3B30] text-white hover:bg-red-600 transition-all font-bold"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    className="px-4 py-2 flex items-center gap-2 rounded-[12px] border-[2px] border-foreground bg-[#0057FF] text-white hover:bg-blue-600 transition-all font-bold"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : <><Check className="w-4 h-4" /> Save</>}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1 block">Full Name</label>
                {!isEditing ? (
                  <p className="font-heading font-bold text-[24px] text-foreground leading-tight">{profile.name}</p>
                ) : (
                  <input
                    type="text"
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD600] transition-shadow"
                  />
                )}
                <p className="font-mono text-[14px] text-muted-foreground mt-1">{profile.email}</p>
              </div>

              <div className="h-[2px] bg-muted w-full my-6" />

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1 block">College</label>
                  {!isEditing ? (
                    <p className="font-sans font-medium text-[16px] text-foreground">{profile.college || "Not set"}</p>
                  ) : (
                    <input
                      type="text"
                      value={editForm.college || ""}
                      onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                      className="w-full px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD600]"
                      placeholder="Your college"
                    />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1 block">Stream</label>
                    {!isEditing ? (
                      <p className="font-sans font-medium text-[16px] text-foreground">{profile.stream || "Not set"}</p>
                    ) : (
                      <input
                        type="text"
                        value={editForm.stream || ""}
                        onChange={(e) => setEditForm({ ...editForm, stream: e.target.value })}
                        className="w-full px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD600]"
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1 block">Course</label>
                    {!isEditing ? (
                      <p className="font-sans font-medium text-[16px] text-foreground">{profile.course || "Not set"}</p>
                    ) : (
                      <input
                        type="text"
                        value={editForm.course || ""}
                        onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                        className="w-full px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD600]"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1 block">Year</label>
                  {!isEditing ? (
                    <p className="font-sans font-medium text-[16px] text-foreground">{profile.year || "Not set"}</p>
                  ) : (
                    <input
                      type="text"
                      value={editForm.year || ""}
                      onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                      className="w-full px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD600]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="bg-card border-[3px] border-foreground rounded-[24px] shadow-[4px_4px_0px_black] p-6">
            <h3 className="font-heading font-bold text-[18px] mb-4">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {(!isEditing ? profile.tags : editForm.tags)?.map((tag) => (
                <div
                  key={tag}
                  className="bg-[#FFD600] border-[2px] border-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[2px_2px_0px_black]"
                >
                  <span className="font-mono text-[13px] font-bold mt-0.5">{tag}</span>
                  {isEditing && (
                    <button
                      onClick={() => removeTag(tag)}
                      className="bg-foreground text-[#FFD600] rounded-full p-0.5 hover:scale-110 transition-transform"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {(!profile.tags?.length && !isEditing) && (
                <p className="text-[14px] text-muted-foreground/70 italic">No interests added yet.</p>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Add a new interest..."
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-3 py-2 rounded-[8px] border-[2px] border-foreground bg-card font-sans focus:outline-none focus:ring-2 focus:ring-[#FFD600]"
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-[#0057FF] text-white border-[2px] border-foreground rounded-[8px] font-bold hover:shadow-[3px_3px_0px_black] hover:-translate-y-1 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* RIGHT PANEL - Stats & Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-7 flex flex-col gap-6"
        >
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<FileText />} value={stats?.vaultFileCount} label="Vault Files" color="bg-[#FF3CAC]" />
            <StatCard icon={<LinkIcon />} value={stats?.vaultLinkCount} label="Vault Links" color="bg-[#FFD600]" />
            <StatCard icon={<Users />} value={stats?.communitiesJoined} label="Joined Comm." color="bg-[#0057FF]" textColor="text-white" />
            <StatCard icon={<Building />} value={stats?.communitiesOwned} label="Owned Comm." color="bg-[#00D4FF]" />
          </div>

          {/* Recent Activity */}
          <div className="bg-card border-[3px] border-foreground rounded-[24px] shadow-[6px_6px_0px_black] p-8 flex-1">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-[2px] border-border">
              <div className="p-2 bg-[#FFD600] rounded-lg border-[2px] border-foreground">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-[20px]">Recent Vault Uploads</h3>
            </div>

            {statsLoading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-background border-[2px] border-border rounded-xl" />
                ))}
              </div>
            ) : stats?.recentItems && stats.recentItems.length > 0 ? (
              <div className="space-y-3">
                {stats.recentItems.map((item) => {
                  const displayName = item.item_type === "link" ? (item.title || "Untitled Link") : (item.files?.filename || item.title || "Unknown File")
                  const handleClick = async () => {
                    if (item.item_type === "link" && item.url) {
                      window.open(item.url, "_blank", "noopener,noreferrer")
                    } else if (item.item_type === "file") {
                      try {
                        const res = await fetch(`/api/vault/items/${item.id}/download?action=view`)
                        if (!res.ok) throw new Error("Failed to open file")
                        const { url } = await res.json()
                        window.open(url, "_blank")
                      } catch (err) {
                        console.error(err)
                      }
                    }
                  }

                  return (
                  <div
                    key={item.id}
                    onClick={handleClick}
                    className="flex justify-between items-center p-4 border-[2px] border-foreground rounded-[12px] bg-background hover:bg-card hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_black] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.item_type === "file" ? 
                        <FileText className="w-5 h-5 shrink-0 text-[#0057FF]" /> : 
                        <LinkIcon className="w-5 h-5 shrink-0 text-[#FF3CAC]" />
                      }
                      <p className="font-sans font-bold text-[15px] truncate">{displayName}</p>
                    </div>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )})}
              </div>
            ) : (
              <div className="text-center py-12 border-[2px] border-dashed border-border rounded-[16px]">
                <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="font-sans text-[15px] text-muted-foreground/70 font-medium">No recent items in your vault.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color, textColor = "text-foreground" }: { icon: React.ReactNode, value?: number, label: string, color: string, textColor?: string }) {
  return (
    <div className={`p-5 rounded-[20px] border-[3px] border-foreground shadow-[4px_4px_0px_black] flex flex-col justify-between h-32 ${color}`}>
      <div className={`w-8 h-8 rounded-full bg-card/20 flex items-center justify-center border-[2px] border-foreground shadow-[2px_2px_0px_black] ${textColor}`}>
        {icon}
      </div>
      <div>
        <p className={`font-mono font-bold text-[28px] leading-none ${textColor}`}>{value !== undefined ? value : "—"}</p>
        <p className={`font-sans font-bold text-[12px] uppercase tracking-wide mt-1 opacity-90 ${textColor}`}>{label}</p>
      </div>
    </div>
  )
}
