"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { deleteObject } from "@/lib/storage"
import { requireUser } from "@/lib/auth"

async function requireModuleRole(supabase: any, moduleId: string, userId: string) {
  const { data: member } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", moduleId)
    .eq("user_id", userId)
    .single()
  return member?.role as string | undefined
}

// ─── Personal Vault: Folders ──────────────────────────────────────────────────

export async function createVaultFolder(name: string, parentId: string | null) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  if (!name?.trim()) throw new Error("Folder name is required")

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", parentId)
      .eq("owner_id", user.id)
      .eq("scope", "vault")
      .single()

    if (parentError || !parent) throw new Error("Parent folder not found or access denied")
  }

  const { data, error } = await supabase
    .from("folders")
    .insert({ owner_id: user.id, name: name.trim(), parent_id: parentId ?? null, scope: "vault" })
    .select()
    .single()

  if (error) throw new Error("Failed to create folder")

  revalidatePath("/vault")
  return data
}

export async function updateVaultFolder(
  folderId: string,
  updates: { name?: string; parent_id?: string | null }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  if (!updates.name && updates.parent_id === undefined) {
    throw new Error("Nothing to update. Provide name or parent_id.")
  }

  const { data: folder, error: fetchError } = await supabase
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("owner_id", user.id)
    .eq("scope", "vault")
    .single()

  if (fetchError || !folder) throw new Error("Folder not found or access denied")

  const payload: Record<string, any> = {}
  if (updates.name) payload.name = updates.name.trim()
  if (updates.parent_id !== undefined) payload.parent_id = updates.parent_id

  const { error: updateError } = await supabase.from("folders").update(payload).eq("id", folderId)
  if (updateError) throw new Error("Failed to update folder")

  revalidatePath("/vault")
  return { success: true }
}

export async function deleteVaultFolder(folderId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { data: folder, error: fetchError } = await supabase
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("owner_id", user.id)
    .eq("scope", "vault")
    .single()

  if (fetchError || !folder) throw new Error("Folder not found or access denied")

  // Rule: deleting a folder moves its files and sub-folders to root, rather than cascading.
  const { error: itemsUpdateError } = await supabase
    .from("vault_items")
    .update({ folder_id: null })
    .eq("folder_id", folderId)
  if (itemsUpdateError) throw new Error("Failed to move child items to root. Deletion aborted.")

  const { error: foldersUpdateError } = await supabase
    .from("folders")
    .update({ parent_id: null })
    .eq("parent_id", folderId)
  if (foldersUpdateError) throw new Error("Failed to move sub-folders to root. Deletion aborted.")

  const { error: deleteError } = await supabase.from("folders").delete().eq("id", folderId)
  if (deleteError) throw new Error("Failed to delete folder")

  revalidatePath("/vault")
  return { success: true }
}

// ─── Personal Vault: Items ────────────────────────────────────────────────────

export async function deleteVaultItem(itemId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { data: vaultItem, error: fetchError } = await supabase
    .from("vault_items")
    .select("*, files(id, storage_key, size_bytes)")
    .eq("id", itemId)
    .eq("owner_id", user.id)
    .single()

  if (fetchError || !vaultItem) throw new Error("File not found or access denied")

  const fileRecord = vaultItem.files

  if (fileRecord?.storage_key) {
    try {
      await deleteObject(fileRecord.storage_key)
    } catch (storageError) {
      console.error("Failed to delete file from object storage:", storageError)
    }

    const { error: fileDeleteError } = await supabase.from("files").delete().eq("id", fileRecord.id)
    if (fileDeleteError) throw new Error("Failed to delete file record")

    if (fileRecord.size_bytes) {
      const { data: userData } = await supabase
        .from("users")
        .select("storage_used_bytes")
        .eq("id", user.id)
        .single()

      if (userData) {
        const newStorage = Math.max((userData.storage_used_bytes || 0) - fileRecord.size_bytes, 0)
        await supabase.from("users").update({ storage_used_bytes: newStorage }).eq("id", user.id)
      }
    }
  } else {
    await supabase.from("vault_items").delete().eq("id", itemId)
  }

  revalidatePath("/vault")
  return { success: true }
}

export async function updateVaultItem(
  itemId: string,
  updates: { filename?: string; tags?: string[]; folder_id?: string | null }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  if (!updates.filename && updates.tags === undefined && updates.folder_id === undefined) {
    throw new Error("Nothing to update.")
  }

  const { data: vaultItem, error: fetchError } = await supabase
    .from("vault_items")
    .select("id, file_id, owner_id")
    .eq("id", itemId)
    .eq("owner_id", user.id)
    .single()

  if (fetchError || !vaultItem) throw new Error("Item not found or access denied")

  if (updates.filename && vaultItem.file_id) {
    const { error: fileUpdateError } = await supabase
      .from("files")
      .update({ filename: updates.filename.trim() })
      .eq("id", vaultItem.file_id)
    if (fileUpdateError) throw new Error("Failed to update filename")
  }

  if (updates.tags !== undefined) {
    const { error: tagsUpdateError } = await supabase
      .from("vault_items")
      .update({ tags: updates.tags })
      .eq("id", itemId)
    if (tagsUpdateError) throw new Error("Failed to update tags")
  }

  if (updates.folder_id !== undefined) {
    const { error: folderUpdateError } = await supabase
      .from("vault_items")
      .update({ folder_id: updates.folder_id })
      .eq("id", itemId)
    if (folderUpdateError) throw new Error("Failed to move file")
  }

  revalidatePath("/vault")
  return { success: true }
}

export async function createVaultLink(input: {
  title: string
  url: string
  tags?: string[]
  folder_id?: string | null
}) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const title = input.title?.trim()
  const url = input.url?.trim()

  if (!title) throw new Error("Title is required.")
  if (!url) throw new Error("URL is required.")
  try {
    new URL(url)
  } catch {
    throw new Error("Invalid URL format.")
  }

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      owner_id: user.id,
      item_type: "link",
      title,
      url,
      is_private: true,
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
      ...(input.folder_id ? { folder_id: input.folder_id } : {}),
    })
    .select()
    .single()

  if (error) throw new Error("Failed to save link to vault.")

  revalidatePath("/vault")
  return data
}

// ─── Module (Community) Vault: Shared Items ───────────────────────────────────

export async function shareToModuleVault(
  moduleId: string,
  input: { vault_item_id: string; folder_id?: string | null }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  if (!input.vault_item_id) throw new Error("Missing vault_item_id")

  const { data: personalVaultItem } = await supabase
    .from("vault_items")
    .select("tags")
    .eq("id", input.vault_item_id)
    .single()

  const { data, error } = await supabase
    .from("community_vault_items")
    .insert({
      community_id: moduleId,
      vault_item_id: input.vault_item_id,
      shared_by_user_id: user.id,
      tags: personalVaultItem?.tags || [],
      folder_id: input.folder_id || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/modules/${moduleId}/vault`)
  return data
}

export async function removeModuleVaultItem(moduleId: string, itemId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const { data: vaultItem, error: fetchError } = await supabase
    .from("community_vault_items")
    .select("shared_by_user_id")
    .eq("id", itemId)
    .eq("community_id", moduleId)
    .single()

  if (fetchError || !vaultItem) throw new Error("Item not found")

  const role = await requireModuleRole(supabase, moduleId, user.id)
  const isSharer = vaultItem.shared_by_user_id === user.id
  const isPrivileged = role === "owner" || role === "curator"

  if (!isSharer && !isPrivileged) throw new Error("Forbidden. You are not allowed to remove this item.")

  const { error: deleteError } = await supabase.from("community_vault_items").delete().eq("id", itemId)
  if (deleteError) throw new Error(deleteError.message)

  revalidatePath(`/modules/${moduleId}/vault`)
  return { success: true }
}

export async function updateModuleVaultItem(
  moduleId: string,
  itemId: string,
  updates: { tags?: string[]; folder_id?: string | null; title?: string }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const role = await requireModuleRole(supabase, moduleId, user.id)
  if (role !== "owner" && role !== "curator") {
    throw new Error("Forbidden: Only owners and curators can organize shared items.")
  }

  const normalizedFolderId =
    updates.folder_id === "null" || updates.folder_id === "" ? null : updates.folder_id ?? null
  const payload: Record<string, any> = { tags: updates.tags, folder_id: normalizedFolderId }
  if (updates.title !== undefined) payload.title = updates.title.trim()

  const { data, error } = await supabase
    .from("community_vault_items")
    .update(payload)
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/modules/${moduleId}/vault`)
  return data
}

// ─── Module (Community) Vault: Folders ────────────────────────────────────────

async function verifyModuleOrganizerRole(supabase: any, moduleId: string, userId: string) {
  const role = await requireModuleRole(supabase, moduleId, userId)
  if (role !== "owner" && role !== "curator") {
    throw new Error("Forbidden: You must be an owner or curator to organize folders.")
  }
}

export async function createModuleVaultFolder(
  moduleId: string,
  input: { name: string; parent_id?: string | null }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  if (!input.name?.trim()) throw new Error("Folder name is required")
  await verifyModuleOrganizerRole(supabase, moduleId, user.id)

  const { data, error } = await supabase
    .from("community_vault_folders")
    .insert({ name: input.name.trim(), parent_id: input.parent_id ?? null, community_id: moduleId, created_by: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/modules/${moduleId}/vault`)
  return data
}

export async function updateModuleVaultFolder(
  moduleId: string,
  folderId: string,
  updates: { name?: string; parent_id?: string | null }
) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const payload: Record<string, any> = {}
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error("Folder name is required")
    payload.name = updates.name.trim()
  }
  if (updates.parent_id !== undefined) {
    payload.parent_id =
      updates.parent_id === "null" || updates.parent_id === "" ? null : updates.parent_id
  }
  if (Object.keys(payload).length === 0) throw new Error("No fields to update")

  await verifyModuleOrganizerRole(supabase, moduleId, user.id)

  const { data: existing, error: fetchError } = await supabase
    .from("community_vault_folders")
    .select("id")
    .eq("id", folderId)
    .eq("community_id", moduleId)
    .single()

  if (fetchError || !existing) throw new Error("Folder not found or does not belong to this module")

  const { data, error } = await supabase
    .from("community_vault_folders")
    .update(payload)
    .eq("id", folderId)
    .eq("community_id", moduleId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/modules/${moduleId}/vault`)
  return data
}

export async function deleteModuleVaultFolder(moduleId: string, folderId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  await verifyModuleOrganizerRole(supabase, moduleId, user.id)

  const { data: folder, error: fetchError } = await supabase
    .from("community_vault_folders")
    .select("id")
    .eq("id", folderId)
    .eq("community_id", moduleId)
    .single()

  if (fetchError || !folder) throw new Error("Folder not found or does not belong to this module")

  async function performRecursiveDelete(fid: string) {
    const { error: itemError } = await supabase
      .from("community_vault_items")
      .delete()
      .eq("folder_id", fid)
      .eq("community_id", moduleId)
    if (itemError) throw itemError

    const { data: subfolders } = await supabase
      .from("community_vault_folders")
      .select("id")
      .eq("parent_id", fid)
      .eq("community_id", moduleId)

    if (subfolders && subfolders.length > 0) {
      for (const sub of subfolders) {
        await performRecursiveDelete(sub.id)
      }
    }

    const { error: folderError } = await supabase
      .from("community_vault_folders")
      .delete()
      .eq("id", fid)
      .eq("community_id", moduleId)
    if (folderError) throw folderError
  }

  await performRecursiveDelete(folderId)

  revalidatePath(`/modules/${moduleId}/vault`)
  return { success: true }
}
