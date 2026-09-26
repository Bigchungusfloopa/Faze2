import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await context.params
    const communityId = resolvedParams.id

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
  } catch (error: any) {
    console.error("Community Vault GET exception:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
