import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getViewUrl } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/**
 * What the preview window needs for one document. The lookup runs through the
 * caller's RLS-scoped client (own file, or a community they belong to) BEFORE
 * getViewUrl signs with the admin key -- so the signed URL is only ever minted
 * for a document the caller can already see.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, source_filename, mime_type, storage_key, status")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const renderable = doc.mime_type === "application/pdf" || doc.mime_type.startsWith("image/");
  const url = await getViewUrl(doc.storage_key);

  // Office, CSV and text files can't be shown natively; show what was extracted.
  let text: string | null = null;
  if (!renderable) {
    const { data: chunks } = await supabase
      .from("chunks")
      .select("content")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true })
      .limit(200);
    text = (chunks ?? []).map((c) => c.content).join("\n\n") || null;
  }

  return NextResponse.json({
    data: { id: doc.id, title: doc.title, filename: doc.source_filename, mimeType: doc.mime_type, status: doc.status, url, text },
  });
}
