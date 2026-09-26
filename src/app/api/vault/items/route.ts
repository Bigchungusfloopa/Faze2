import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // folder_id=null  → items at root (folder_id IS NULL)
    // folder_id=<uuid> → items inside that folder
    const folderIdParam = searchParams.get("folder_id")

    let query = supabase
      .from('vault_items')
      .select('id, created_at, item_type, title, url, tags, folder_id, files(id, filename, mime_type, size_bytes), community_vault_items(community_id, communities(name))')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (folderIdParam) {
      // Specific folder
      query = query.eq('folder_id', folderIdParam)
    }
    // If no folder_id is provided, fetch all files regardless of their folder location

    const { data, error } = await query

    if (error) {
      console.error("Vault items fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch vault items" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("Vault items GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
