import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewUrl, getDownloadUrl } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string, itemId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await context.params
    const { id: communityId, itemId } = resolvedParams
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") ?? "view"

    // Verify user is in the community
    const { data: member, error: memberError } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !member || member.role === 'pending') {
      return NextResponse.json({ error: "Access Denied. Join community to download." }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // Fetch the community vault item & linked vault item files using admin client
    const { data: sharedItem, error: fetchError } = await adminSupabase
      .from('community_vault_items')
      .select(`
        vault_item:vault_items (
          id,
          files ( storage_key, filename, mime_type )
        )
      `)
      .eq('id', itemId)
      .eq('community_id', communityId)
      .single()

    const vItem: any = Array.isArray(sharedItem?.vault_item) 
       ? sharedItem.vault_item[0] 
       : sharedItem?.vault_item

    const file: any = Array.isArray(vItem?.files) ? vItem.files[0] : vItem?.files

    if (fetchError || !sharedItem || !vItem || !file) {
      return NextResponse.json({ error: "File not found or missing physical data" }, { status: 404 })
    }

    let signedUrl: string
    if (action === "download") {
      signedUrl = await getDownloadUrl(file.storage_key, file.filename || "file", file.mime_type || undefined)
    } else {
      signedUrl = await getViewUrl(file.storage_key)
    }

    return NextResponse.json({ url: signedUrl })
  } catch (error: any) {
    console.error("Community Download GET error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
