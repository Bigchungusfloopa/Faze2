export interface VaultFolder {
  id: string
  name: string
  parent_id: string | null
}

export interface VaultFile {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
}

export interface VaultItemCommunityShare {
  community_id: string
  communities?: { name: string } | null
}

export interface VaultItem {
  id: string
  created_at: string
  item_type?: string | null
  title?: string | null
  url?: string | null
  tags: string[] | null
  folder_id: string | null
  files: VaultFile | null
  // Present when the query joins community_vault_items(community_id, communities(name)),
  // as src/app/api/vault/items/route.ts does. Absent otherwise.
  community_vault_items?: VaultItemCommunityShare[]
}
