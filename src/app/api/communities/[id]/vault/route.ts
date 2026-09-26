import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await context.params
    const communityId = resolvedParams.id

    const adminSupabase = createAdminClient()

    // Fetch all items for the community to allow frontend global searching
    const { data, error } = await adminSupabase
      .from('community_vault_items')
      .select('*, users(*), vault_items(*, files(*))')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Community Vault GET error:", error)
      return NextResponse.json({ error: "Failed to fetch shared vault items" }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error: unknown) {
    console.error("Community Vault GET exception:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
