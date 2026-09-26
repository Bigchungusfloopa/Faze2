import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { putObject } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const MAX_STORAGE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customFilename = (formData.get("filename") as string | null)?.trim() || null;
    // Parse tags JSON array sent by the client (e.g. '["lecture","notes"]')
    let initialTags: string[] = [];
    const tagsRaw = formData.get("tags") as string | null;
    if (tagsRaw) {
      try { initialTags = JSON.parse(tagsRaw); } catch { /* ignore bad JSON */ }
    }
    // Optional folder_id — null means root
    const folderId = (formData.get("folder_id") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20MB limit." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const checksum = createHash("sha256").update(Buffer.from(buffer)).digest("hex");

    // 1. Atomic quota check + increment.
    // Previously this was a separate read, a check in application code, then a
    // write of the summed value -- two concurrent uploads could both pass the
    // check and both write, losing an increment (a lost update), and there was
    // a gap between the check and the write for a third request to land in.
    // bump_storage_used() does both in one statement: the row is locked by the
    // UPDATE, and the limit is a predicate on that same UPDATE rather than a
    // prior read.
    let newStorageUsed: number;
    try {
      const { data, error: quotaError } = await supabase.rpc("bump_storage_used", {
        p_user: user.id,
        p_delta: file.size,
        p_limit: MAX_STORAGE,
      });
      if (quotaError) throw quotaError;
      newStorageUsed = data as number;
    } catch (quotaError) {
      console.error("Storage quota error:", quotaError);
      return NextResponse.json(
        { error: "Upload would exceed your 500MB storage quota." },
        { status: 400 }
      );
    }

    // 2. Process & upload to object storage.
    const fileExt = file.name.split('.').pop() || 'bin';
    const uniqueFileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    try {
      await putObject(new Uint8Array(buffer), uniqueFileName, file.type);
    } catch (storageError) {
      console.error("Storage upload error:", storageError);
      // Roll back the quota increment: the bytes never landed in the bucket.
      await supabase.rpc("bump_storage_used", { p_user: user.id, p_delta: -file.size, p_limit: MAX_STORAGE });
      return NextResponse.json({ error: "Failed to upload file to storage." }, { status: 500 });
    }

    // 3. Database metadata sync.
    const { data: fileData, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        owner_id: user.id,
        storage_key: uniqueFileName,
        filename: customFilename || file.name,
        mime_type: file.type,
        size_bytes: file.size,
        checksum_sha256: checksum,
      })
      .select()
      .single()

    if (fileInsertError) {
      console.error("File DB Insert Error:", fileInsertError)
      await supabase.rpc("bump_storage_used", { p_user: user.id, p_delta: -file.size, p_limit: MAX_STORAGE });
      return NextResponse.json({ error: "Database metadata sync failed." }, { status: 500 })
    }

    // Insert into vault_items — include initial tags and folder if provided
    const { data: vaultItemData, error: vaultInsertError } = await supabase
      .from('vault_items')
      .insert({
        file_id: fileData.id,
        owner_id: user.id,
        item_type: 'file',
        is_private: true,
        ...(initialTags.length > 0 ? { tags: initialTags } : {}),
        ...(folderId ? { folder_id: folderId } : {}),
      })
      .select()
      .single()

    if (vaultInsertError) {
      console.error("Vault DB Insert Error:", vaultInsertError)
      return NextResponse.json({ error: "Vault linkage failed." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: fileData,
      vaultItem: vaultItemData,
      storageUsedBytes: newStorageUsed,
    });
  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
