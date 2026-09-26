import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/storage";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const { data: events } = await supabase
    .from("ingestion_events")
    .select("id, stage, status, detail, ms, created_at")
    .eq("document_id", id)
    .order("id", { ascending: true });

  return NextResponse.json({ data: { ...doc, events: events ?? [] } });
}

// Visibility and permission come from RLS: documents_select lets any member
// see a community file, documents_delete lets its uploader or a community
// Admin remove it. So no owner_id filter here -- that would lock Admins out.
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Delete the row first and confirm RLS actually allowed it, THEN the file:
  // an object removed for a row the caller wasn't allowed to delete would be
  // unrecoverable data loss.
  const { data: deleted, error: deleteError } = await supabase.from("documents").delete().eq("id", id).select("id");
  if (deleteError) {
    console.error("document delete error:", deleteError);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Only the uploader or a community Admin can delete this file." }, { status: 403 });
  }

  try {
    await deleteObject(doc.storage_key);
  } catch (storageError) {
    console.error("Document row deleted but stored file removal failed:", doc.storage_key, storageError);
  }

  return NextResponse.json({ success: true });
}
