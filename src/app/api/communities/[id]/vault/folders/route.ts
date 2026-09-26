import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: communityId } = await context.params

    const adminSupabase = createAdminClient()

    const { data: folders, error } = await adminSupabase
      .from('community_vault_folders')
      .select('*')
      .eq('community_id', communityId)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data: folders })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
