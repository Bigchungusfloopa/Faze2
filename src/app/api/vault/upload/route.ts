import { NextResponse } from "next/server";
import { uploadFileToR2 } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

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

    // 1. Quota Check
    const { data: userData, error: userQueryError } = await supabase
      .from('users')
      .select('storage_used_bytes')
      .eq('id', user.id)
      .single()

    if (userQueryError && userQueryError.code !== 'PGRST116') {
      // PGRST116 is no rows, which shouldn't happen, but we won't log on completely empty mock db
      console.error("Storage lookup error:", userQueryError)
    }

    const currentUsed = userData?.storage_used_bytes || 0
    const MAX_STORAGE = 500 * 1024 * 1024 // 500 MB
    if (currentUsed + file.size > MAX_STORAGE) {
      return NextResponse.json({ error: "Upload would exceed your 500MB storage quota." }, { status: 400 })
    }

    // 2. Process & Upload to R2
    const buffer = await file.arrayBuffer();
    const fileExt = file.name.split('.').pop() || 'bin';
    const uniqueFileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    await uploadFileToR2(new Uint8Array(buffer), uniqueFileName, file.type);

    // 3. Database Metadata Sync
    // Insert into files table
    const { data: fileData, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        owner_id: user.id,
        r2_object_key: uniqueFileName,
        filename: customFilename || file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single()

    if (fileInsertError) {
      console.error("File DB Insert Error:", fileInsertError)
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

    // Update storage quota
    const { error: updateError } = await supabase
      .from('users')
      .update({ storage_used_bytes: currentUsed + file.size })
      .eq('id', user.id)

    if (updateError) {
      console.error("Quota increment error:", updateError)
    }

    return NextResponse.json({
      success: true,
      data: fileData,
      vaultItem: vaultItemData
    });
  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
