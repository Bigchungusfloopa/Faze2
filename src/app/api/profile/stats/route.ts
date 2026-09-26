import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Vault Files Count
    const { count: vaultFileCount, error: fileError } = await supabase
      .from("vault_items")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("item_type", "file")

    // Vault Links Count
    const { count: vaultLinkCount, error: linkError } = await supabase
      .from("vault_items")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("item_type", "link")

    // Communities Joined
    const { count: communitiesJoined, error: joinedError } = await supabase
      .from("community_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    // Communities Owned
    const { count: communitiesOwned, error: ownedError } = await supabase
      .from("communities")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)

    // Recent items
    const { data: recentItems, error: recentError } = await supabase
      .from("vault_items")
      .select("id, title, item_type, url, created_at, files(filename)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (fileError || linkError || joinedError || ownedError || recentError) {
      console.error("Error fetching stats:", { fileError, linkError, joinedError, ownedError, recentError })
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
    }

    return NextResponse.json({
      vaultFileCount: vaultFileCount ?? 0,
      vaultLinkCount: vaultLinkCount ?? 0,
      communitiesJoined: communitiesJoined ?? 0,
      communitiesOwned: communitiesOwned ?? 0,
      recentItems: recentItems ?? [],
    })
  } catch (error) {
    console.error("Error in profile stats API:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
