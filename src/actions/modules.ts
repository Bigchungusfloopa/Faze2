"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

interface CreateModuleData {
  name: string
  description?: string
  type: string
}

interface UpdateModuleDetailsData {
  name: string
  description?: string
  type: string
  banner_url?: string
}

async function requireUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user
}

async function verifyOwner(supabase: any, moduleId: string): Promise<boolean> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return false

  const { data: membershipData, error: membershipError } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", moduleId)
    .eq("user_id", authData.user.id)
    .single()

  if (membershipError || !membershipData || membershipData.role !== "owner") {
    return false
  }

  return true
}

async function syncMemberCount(supabase: any, moduleId: string) {
  const { count, error } = await supabase
    .from("community_members")
    .select("*", { count: "exact", head: true })
    .eq("community_id", moduleId)
    .in("role", ["peer", "owner", "curator"])

  if (!error && count !== null) {
    await supabase.from("communities").update({ member_count: count }).eq("id", moduleId)
  }
}

// ─── Module Lifecycle ──────────────────────────────────────────────────────────

export async function createModule(data: CreateModuleData) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { data: module_, error: insertError } = await supabase
    .from("communities")
    .insert([{ name: data.name, description: data.description, type: data.type, owner_id: user.id }])
    .select()
    .single()

  if (insertError) throw new Error(insertError.message)

  const { error: memberError } = await supabase
    .from("community_members")
    .insert([{ community_id: module_.id, user_id: user.id, role: "owner" }])

  if (memberError) throw new Error(memberError.message)

  await syncMemberCount(supabase, module_.id)

  const { data: updatedModule } = await supabase
    .from("communities")
    .select("*")
    .eq("id", module_.id)
    .single()

  revalidatePath("/modules")
  return updatedModule || module_
}

export async function joinModule(moduleId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { data: module_, error: fetchError } = await supabase
    .from("communities")
    .select("type")
    .eq("id", moduleId)
    .single()

  if (fetchError || !module_) throw new Error("Module not found")

  const role = module_.type === "Private" ? "pending" : "peer"

  const { error } = await supabase
    .from("community_members")
    .insert([{ community_id: moduleId, user_id: user.id, role }])

  if (error) throw new Error(error.message)

  if (role === "peer") await syncMemberCount(supabase, moduleId)

  revalidatePath(`/modules/${moduleId}`)
  revalidatePath("/modules")
  return { success: true, role }
}

export async function leaveModule(moduleId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", moduleId)
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)

  await syncMemberCount(supabase, moduleId)

  revalidatePath(`/modules/${moduleId}`)
  revalidatePath("/modules")
  return { success: true }
}

export async function deleteModule(moduleId: string) {
  const supabase = await createClient()

  const isOwner = await verifyOwner(supabase, moduleId)
  if (!isOwner) {
    throw new Error("Unauthorized. Only the owner can delete the module.")
  }

  const { error } = await supabase.from("communities").delete().eq("id", moduleId)

  if (error) {
    console.error("Error deleting module:", error)
    throw new Error("Failed to delete module.")
  }

  // Assume cascading deletes are handled in DB as stated
  revalidatePath("/modules")
  return { success: true }
}

// ─── Module Settings ────────────────────────────────────────────────────────────

export async function updateModuleDetails(moduleId: string, data: UpdateModuleDetailsData) {
  const supabase = await createClient()

  const isOwner = await verifyOwner(supabase, moduleId)
  if (!isOwner) {
    throw new Error("Unauthorized. Only the owner can update module details.")
  }

  const { error } = await supabase
    .from("communities")
    .update({
      name: data.name,
      description: data.description || null,
      type: data.type,
      banner_url: data.banner_url || null,
    })
    .eq("id", moduleId)

  if (error) {
    console.error("Error updating module details:", error)
    throw new Error("Failed to update module details.")
  }

  revalidatePath(`/modules/${moduleId}`)
  return { success: true }
}

// ─── Module Members ──────────────────────────────────────────────────────────

export async function getModuleMembers(moduleId: string) {
  const supabase = await createClient()

  // Verify the user is at least a member before exposing roster
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    throw new Error("Unauthorized")
  }

  const { data: membershipData } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", moduleId)
    .eq("user_id", authData.user.id)
    .single()

  if (!membershipData) {
    throw new Error("You must be a member to view the roster")
  }

  const { data, error } = await supabase
    .from("community_members")
    .select(`
      role,
      user_id,
      joined_at,
      users:user_id (
        id,
        name,
        email,
        profile_pic
      )
    `)
    .eq("community_id", moduleId)

  if (error) {
    console.error("Error fetching module members:", error)
    throw new Error("Failed to fetch module members.")
  }

  return data.map((item: any) => {
    const u = Array.isArray(item.users) ? item.users[0] : item.users
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      profile_pic: u.profile_pic,
      role: item.role,
      joined_at: item.joined_at,
    }
  })
}

export async function updateMemberRole(moduleId: string, userId: string, newRole: string) {
  const supabase = await createClient()

  const isOwner = await verifyOwner(supabase, moduleId)
  if (!isOwner) {
    throw new Error("Unauthorized. Only the owner can update member roles.")
  }

  const { data: currentTargetData } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", moduleId)
    .eq("user_id", userId)
    .single()

  if (currentTargetData?.role === "owner") {
    throw new Error("Cannot change role of the owner.")
  }

  const { error } = await supabase
    .from("community_members")
    .update({ role: newRole })
    .eq("community_id", moduleId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error updating member role:", error)
    throw new Error("Failed to update member role.")
  }

  if (newRole === "peer" || newRole === "owner" || newRole === "curator") {
    await syncMemberCount(supabase, moduleId)
  }

  revalidatePath(`/modules/${moduleId}`)
  return { success: true }
}

export async function removeMember(moduleId: string, userId: string) {
  const supabase = await createClient()

  const isOwner = await verifyOwner(supabase, moduleId)
  if (!isOwner) {
    throw new Error("Unauthorized. Only the owner can remove members.")
  }

  const { data: currentTargetData } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", moduleId)
    .eq("user_id", userId)
    .single()

  if (currentTargetData?.role === "owner") {
    throw new Error("Cannot kick the owner.")
  }

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", moduleId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error removing member:", error)
    throw new Error("Failed to remove member.")
  }

  await syncMemberCount(supabase, moduleId)

  revalidatePath(`/modules/${moduleId}`)
  return { success: true }
}
