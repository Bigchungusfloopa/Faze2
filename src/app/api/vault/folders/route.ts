import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all vault-scoped folders the user owns, ordered by name
    const { data, error } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("owner_id", user.id)
      .eq("scope", "vault")
      .order("name", { ascending: true });

    if (error) {
      console.error("Folders fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Folders GET error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
