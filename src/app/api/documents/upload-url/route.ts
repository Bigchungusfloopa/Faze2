import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUploadUrl } from "@/lib/storage";

const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MB — under Gemini's native 50MB PDF cap
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

/**
 * Step 1 of a direct-to-bucket upload: the client asks for a presigned PUT
 * before it has sent any bytes. This sidesteps the ~4.5MB serverless
 * request-body ceiling that the vault's multipart upload route only survives
 * by luck at its 20MB cap.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const filename = (body?.filename as string | undefined)?.trim();
  const mimeType = body?.mimeType as string | undefined;
  const sizeBytes = Number(body?.sizeBytes);
  const checksumSha256 = body?.checksumSha256 as string | undefined;

  if (!filename || !mimeType || !checksumSha256 || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: "filename, mimeType, sizeBytes and checksumSha256 are required." },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. PDF, PNG, JPEG, WEBP, TXT, MD and CSV only.` },
      { status: 400 }
    );
  }
  if (sizeBytes > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds the 45MB limit." }, { status: 400 });
  }

  // Dedupe: the same bytes from the same owner reuse the existing document
  // rather than re-ingesting. This is enforced by the unique constraint on
  // documents(owner_id, checksum_sha256), not merely checked here -- this
  // lookup is a fast path that avoids minting an unused presigned URL.
  const { data: existing } = await supabase
    .from("documents")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("checksum_sha256", checksumSha256)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ documentId: existing.id, duplicate: true, uploadUrl: null });
  }

  const ext = filename.split(".").pop() || "bin";
  const storageKey = `${user.id}/documents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      owner_id: user.id,
      title: filename,
      source_filename: filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_key: storageKey,
      checksum_sha256: checksumSha256,
      status: "pending_upload" as const,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("documents insert error:", insertError);
    return NextResponse.json({ error: "Failed to register document." }, { status: 500 });
  }

  const uploadUrl = await getUploadUrl(storageKey, mimeType);
  return NextResponse.json({ documentId: doc.id, duplicate: false, uploadUrl });
}
