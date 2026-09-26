"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { 
  FolderSync, 
  ArrowRight, 
  FileText, 
  Link2, 
  Sparkles,
  Info
} from "lucide-react"

export default function ModuleHomePage() {
  const params = useParams()
  const id = params.id as string

  // Fetch community details
  const { data: community } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${id}`)
      if (!res.ok) throw new Error("Failed to fetch community")
      return res.json()
    },
  })

  // Fetch community vault items
  const { data: vaultResponse, isLoading: vaultLoading } = useQuery({
    queryKey: ["communityVaultItems", id],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${id}/vault`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const vaultItems = vaultResponse?.data || []
  const role = community?.membership?.role
  const isMember = role === "owner" || role === "curator" || role === "peer"

  return (
    <div className="space-y-8 mt-6">
      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vault Card */}
        <div className="md:col-span-2 bg-card border-[3px] border-foreground rounded-[1.5rem] p-6 shadow-[6px_6px_0px_black] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-32 h-32 rounded-full border-[2px] border-foreground bg-[#FFD600]/20 pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-[14px] bg-[#FFD600] border-[2px] border-foreground flex items-center justify-center shadow-[3px_3px_0px_black]">
                <FolderSync className="w-6 h-6 text-foreground" />
              </div>
              <span className="px-3 py-1 rounded-full border-[2px] border-foreground bg-background font-mono text-[12px] font-bold shadow-[2px_2px_0px_black]">
                {vaultItems.length} {vaultItems.length === 1 ? "Resource" : "Resources"}
              </span>
            </div>

            <div>
              <h2 className="font-heading font-extrabold text-[24px] text-foreground">
                Community Vault
              </h2>
              <p className="font-sans text-[15px] text-muted-foreground mt-1 max-w-lg">
                Collaborative file depository for lecture notes, reference PDFs, past papers, and useful links curated by community members.
              </p>
            </div>
          </div>

          <div className="pt-6 relative z-10">
            <Link
              href={`/modules/${id}/vault`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[1rem] border-[3px] border-foreground bg-[#FFD600] shadow-[4px_4px_0px_black] font-heading font-bold text-[15px] text-foreground hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              <span>Explore Vault</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Community Info Card */}
        <div className="bg-card border-[3px] border-foreground rounded-[1.5rem] p-6 shadow-[6px_6px_0px_black] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-[8px] bg-background border-[2px] border-foreground flex items-center justify-center">
                <Info className="w-4 h-4 text-foreground" />
              </div>
              <h3 className="font-heading font-bold text-[18px] text-foreground">
                About Module
              </h3>
            </div>
            
            <div className="space-y-3 font-sans text-[14px]">
              <div className="flex items-center justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Access Type</span>
                <span className="font-mono font-bold">{community?.type || "Public"}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Total Members</span>
                <span className="font-mono font-bold">{community?.member_count || 1}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Your Status</span>
                <span className="font-mono font-bold capitalize">
                  {role ? role : "Visitor"}
                </span>
              </div>
            </div>
          </div>

          {!isMember && (
            <div className="p-3 bg-[#FFD600]/20 border-[2px] border-foreground rounded-[12px] text-[13px] font-medium text-foreground">
              👉 Click <strong>Join Module</strong> above to get full access to shared resources.
            </div>
          )}
        </div>
      </div>

      {/* Recent Vault Resources Preview */}
      <div className="bg-card border-[3px] border-foreground rounded-[1.5rem] p-6 shadow-[6px_6px_0px_black] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-foreground" />
            <h3 className="font-heading font-extrabold text-[20px] text-foreground">
              Recent Vault Resources
            </h3>
          </div>
          <Link
            href={`/modules/${id}/vault`}
            className="font-heading font-bold text-[13px] text-foreground hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {vaultLoading ? (
          <div className="py-8 text-center text-muted-foreground font-sans text-[14px]">
            Loading recent resources...
          </div>
        ) : vaultItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground font-sans text-[14px] bg-background border-[2px] border-dashed border-border rounded-[1rem]">
            No resources shared in this module yet. Be the first to share from your vault!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaultItems.slice(0, 6).map((item: any) => {
              const isLink = item.vault_items?.item_type === "link"
              const title = item.vault_items?.title || item.vault_items?.files?.filename || "Untitled"
              const sharedBy = item.users?.name || "Community Member"

              return (
                <div
                  key={item.id}
                  className="bg-background border-[2px] border-foreground rounded-[14px] p-4 shadow-[3px_3px_0px_black] flex flex-col justify-between gap-3 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-[10px] bg-card border-[2px] border-foreground flex items-center justify-center">
                      {isLink ? (
                        <Link2 className="w-4 h-4 text-[#0057FF]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#FF3CAC]" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-heading font-bold text-[14px] text-foreground truncate">
                        {title}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground truncate">
                        by {sharedBy}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {isLink ? "Link" : "File"}
                    </span>
                    <Link
                      href={`/modules/${id}/vault`}
                      className="font-heading font-bold text-[12px] text-foreground hover:underline flex items-center gap-1"
                    >
                      Open <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
