import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Settings, Shield, UserMinus, Globe, Lock, Trash2, Loader2, ImagePlus } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

import {
  updateModuleDetails,
  getModuleMembers,
  updateMemberRole,
  removeMember,
  deleteModule
} from "@/actions/modules"

interface CommunitySettingsModalProps {
  community: any
  currentUserRole?: string
}

export function CommunitySettingsModal({ community, currentUserRole }: CommunitySettingsModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  
  // General Tab State
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description || "")
  const [type, setType] = useState(community.type)
  const [bannerUrl, setBannerUrl] = useState(community.banner_url || "")
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false)

  // Members Tab State
  const [members, setMembers] = useState<any[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [mutatingMemberId, setMutatingMemberId] = useState<string | null>(null)

  // Danger Zone State
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwner = currentUserRole === "owner"

  // Only owners can access settings
  if (!isOwner) return null

  // Fetch members when opening members tab
  useEffect(() => {
    if (open && activeTab === "members" && members.length === 0) {
      loadMembers()
    }
  }, [open, activeTab])

  const loadMembers = async () => {
    setIsLoadingMembers(true)
    try {
      const data = await getModuleMembers(community.id)
      setMembers(data)
    } catch (error: any) {
      toast.error(error instanceof Error ? error.message : "Failed to load members")
    } finally {
      setIsLoadingMembers(false)
    }
  }

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingDetails(true)
    try {
      await updateModuleDetails(community.id, {
        name,
        description,
        type,
        banner_url: bannerUrl,
      })
      toast.success("Community details updated")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update community details")
    } finally {
      setIsUpdatingDetails(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setMutatingMemberId(userId)
    try {
      await updateMemberRole(community.id, userId, newRole)
      setMembers(members.map(m => m.id === userId ? { ...m, role: newRole } : m))
      toast.success("Member role updated")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    } finally {
      setMutatingMemberId(null)
    }
  }

  const handleKickMember = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from the community?`)) {
      return
    }
    setMutatingMemberId(userId)
    try {
      await removeMember(community.id, userId)
      setMembers(members.filter(m => m.id !== userId))
      toast.success(`${userName} removed from community`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
      setMutatingMemberId(null) // Only unset on error so button stays disabled if successful (row will unmount)
    }
  }

  const handleDeleteCommunity = async () => {
    if (!window.confirm(`DANGER: Are you sure you want to permanently delete "${community.name}"? This action CANNOT be undone, and all community data will be lost.`)) {
      return
    }
    
    // Double confirmation for safety
    const confirmName = window.prompt(`To confirm deletion, please type the community name exactly: "${community.name}"`)
    if (confirmName !== community.name) {
      toast.error("Community name did not match. Deletion cancelled.")
      return
    }

    setIsDeleting(true)
    try {
      await deleteModule(community.id)
      toast.success("Community deleted")
      setOpen(false)
      router.push("/modules")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete community")
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="Community Settings"
          className="w-12 h-12 rounded-[12px] border-[2px] border-foreground bg-card shadow-[3px_3px_0px_black] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all flex items-center justify-center"
        >
          <Settings className="w-5 h-5 text-foreground" />
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b-[2px] border-foreground bg-background shrink-0">
          <DialogTitle className="font-heading font-extrabold text-[22px] flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] bg-foreground flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            Community Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-3 p-1 bg-muted border-[2px] border-foreground rounded-[1rem]">
              <TabsTrigger 
                value="general"
                className="rounded-[0.75rem] font-bold font-heading data-[state=active]:bg-card data-[state=active]:border-[2px] data-[state=active]:border-foreground data-[state=active]:shadow-[2px_2px_0px_black]"
              >
                General
              </TabsTrigger>
              <TabsTrigger 
                value="members"
                className="rounded-[0.75rem] font-bold font-heading data-[state=active]:bg-card data-[state=active]:border-[2px] data-[state=active]:border-foreground data-[state=active]:shadow-[2px_2px_0px_black]"
              >
                Members
              </TabsTrigger>
              <TabsTrigger 
                value="danger"
                className="rounded-[0.75rem] font-bold font-heading data-[state=active]:bg-[#FF3B30] data-[state=active]:text-white data-[state=active]:border-[2px] data-[state=active]:border-foreground data-[state=active]:shadow-[2px_2px_0px_black]"
              >
                Danger Zone
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {/* ── GENERAL TAB ── */}
            <TabsContent value="general" className="mt-0 space-y-6">
              <form onSubmit={handleUpdateDetails} className="space-y-5">
                <div className="space-y-2">
                  <label className="font-heading font-bold text-[14px]">Community Name</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required
                    className="border-[2px] border-foreground shadow-[3px_3px_0px_black] rounded-[0.75rem] h-12 font-sans font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-heading font-bold text-[14px]">Description</label>
                  <Textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="border-[2px] border-foreground shadow-[3px_3px_0px_black] rounded-[0.75rem] font-sans resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-heading font-bold text-[14px]">Privacy Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="border-[2px] border-foreground shadow-[3px_3px_0px_black] rounded-[0.75rem] h-12 font-sans font-medium">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="border-[2px] border-foreground rounded-[1rem] shadow-[4px_4px_0px_black]">
                      <SelectItem value="Public" className="font-medium cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#00C853]" /> Public (Anyone can join)
                        </div>
                      </SelectItem>
                      <SelectItem value="Private" className="font-medium cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-[#FF6B00]" /> Private (Requires approval)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="font-heading font-bold text-[14px]">Banner URL</label>
                  <div className="flex gap-2">
                    <Input 
                      value={bannerUrl} 
                      onChange={e => setBannerUrl(e.target.value)} 
                      placeholder="https://example.com/image.png"
                      className="border-[2px] border-foreground shadow-[3px_3px_0px_black] rounded-[0.75rem] h-12 font-sans flex-1"
                    />
                    {/* Placeholder for custom upload connection later */}
                    <div className="w-12 h-12 bg-muted border-[2px] border-foreground shadow-[3px_3px_0px_black] rounded-[0.75rem] flex items-center justify-center shrink-0 cursor-not-allowed opacity-50" title="Direct upload coming soon">
                       <ImagePlus className="w-5 h-5" />
                    </div>
                  </div>
                  {bannerUrl && (
                     <div className="mt-3 h-24 rounded-[0.75rem] border-[2px] border-foreground overflow-hidden relative">
                         <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                     </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isUpdatingDetails}
                    className="h-12 px-6 rounded-[0.75rem] bg-[#FFD600] text-foreground border-[2px] border-foreground shadow-[3px_3px_0px_black] hover:bg-[#FFD600] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all font-heading font-bold text-[16px]"
                  >
                    {isUpdatingDetails ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ── MEMBERS TAB ── */}
            <TabsContent value="members" className="mt-0 h-full flex flex-col">
              {isLoadingMembers ? (
                <div className="flex-1 flex items-center justify-center py-12">
                   <Loader2 className="w-8 h-8 animate-spin text-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-[2px] border-dashed border-foreground pb-3">
                    <h3 className="font-heading font-extrabold text-[16px]">Community Roster</h3>
                    <span className="bg-muted px-3 py-1 rounded-full text-[12px] font-bold border-[2px] border-foreground">
                       {members.length} member{members.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {members.map(member => {
                      const isMe = member.id === community.membership?.user_id // Assuming we pass this prop fully or handle it. Might need a currentUserId prop if not available.
                      // Actually, let's just check if role is owner. The current user IS the owner.
                      // More robust: we can't change 'owner' role easily this way.
                      isMe; // Silence unused warning

                      
                      const isTargetOwner = member.role === 'owner'
                      const isMutating = mutatingMemberId === member.id

                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-[1rem] border-[2px] border-foreground bg-card">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[8px] bg-muted border-[1.5px] border-foreground overflow-hidden">
                                {member.profile_pic ? (
                                    <img src={member.profile_pic} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-[16px]">
                                        {member.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                              </div>
                              <div>
                                 <div className="font-heading font-bold text-[14px]">
                                     {member.name} 
                                     {isTargetOwner && <span className="ml-2 text-[10px] bg-[#FFD600] px-1.5 py-0.5 rounded-[4px] border-[1px] border-foreground uppercase tracking-wide">Owner</span>}
                                 </div>
                                 <div className="text-[12px] text-muted-foreground">
                                     {member.email}
                                 </div>
                              </div>
                           </div>

                           {!isTargetOwner && (
                             <div className="flex items-center gap-2">
                               <Select 
                                 value={member.role} 
                                 onValueChange={(val) => handleRoleChange(member.id, val)}
                                 disabled={isMutating}
                               >
                                 <SelectTrigger className="w-[110px] h-9 border-[2px] border-foreground shadow-[2px_2px_0px_black] rounded-[0.5rem] font-bold text-[12px] bg-card">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="border-[2px] border-foreground rounded-[0.75rem]">
                                    <SelectItem value="curator" className="font-bold cursor-pointer text-[12px]">Curator</SelectItem>
                                    <SelectItem value="peer" className="font-bold cursor-pointer text-[12px]">Peer</SelectItem>
                                 </SelectContent>
                               </Select>

                               <button
                                 onClick={() => handleKickMember(member.id, member.name)}
                                 disabled={isMutating}
                                 title="Kick Member"
                                 className="w-9 h-9 flex items-center justify-center rounded-[0.5rem] border-[2px] border-foreground bg-[#FF3B30] text-white shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                               >
                                  {isMutating && mutatingMemberId === member.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                      <UserMinus className="w-4 h-4" />
                                  )}
                               </button>
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── DANGER ZONE TAB ── */}
            <TabsContent value="danger" className="mt-0 space-y-6">
               <div className="p-5 border-[2px] border-[#FF3B30] bg-[#FF3B30]/10 rounded-[1rem] space-y-4">
                  <div className="flex items-start gap-3 text-[#FF3B30]">
                     <Shield className="w-6 h-6 shrink-0 mt-0.5" />
                     <div>
                        <h4 className="font-heading font-extrabold text-[18px]">Danger Zone</h4>
                        <p className="font-sans text-[14px] mt-1 text-foreground">
                           Proceed with extreme caution. Actions taken here are permanent and cannot be reversed.
                        </p>
                     </div>
                  </div>

                  <div className="pt-4 border-t-[2px] border-dashed border-[#FF3B30]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div>
                         <h5 className="font-bold text-[15px] text-foreground">Delete Community</h5>
                         <p className="text-[13px] text-muted-foreground">Permanently remove this community and all its data.</p>
                     </div>
                     <button
                       onClick={handleDeleteCommunity}
                       disabled={isDeleting}
                       className="shrink-0 h-11 px-5 rounded-[0.75rem] bg-[#FF3B30] text-white border-[2px] border-foreground shadow-[3px_3px_0px_black] hover:bg-[#FF3B30] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all font-heading font-bold text-[14px] flex items-center justify-center gap-2"
                     >
                       {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                       Delete Community
                     </button>
                  </div>
               </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
