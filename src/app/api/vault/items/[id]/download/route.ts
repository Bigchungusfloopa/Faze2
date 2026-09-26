import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrlForR2, getSignedUrlForR2Download } from "@/lib/r2";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "view"; // default to view

    const { data: vaultItem, error: fetchError } = await supabase
      .from('vault_items')
      .select('*, files(r2_object_key, filename, mime_type)')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !vaultItem) {
      return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
    }

    if (!vaultItem.files?.r2_object_key) {
      return NextResponse.json({ error: "No physical file associated with this item" }, { status: 400 });
    }

    let signedUrl: string;

    if (action === "download") {
      const filename = vaultItem.files.filename || "file";
      const mimeType = vaultItem.files.mime_type || undefined;
      signedUrl = await getSignedUrlForR2Download(vaultItem.files.r2_object_key, filename, mimeType);
    } else {
      signedUrl = await getSignedUrlForR2(vaultItem.files.r2_object_key);
    }

    return NextResponse.json({ url: signedUrl });
  } catch (error: any) {
    console.error("Download GET error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
