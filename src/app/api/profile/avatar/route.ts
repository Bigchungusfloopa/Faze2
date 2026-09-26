import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB for avatars
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Avatar exceeds 5MB limit." }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `${user.id}-${Date.now()}.${fileExt}`;

    // Admin client to bypass RLS since the bucket might not have INSERT allowed for public
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upload to Supabase 'avatars' bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload avatar to storage." }, { status: 500 });
    }

    // Get the public URL for the newly uploaded avatar
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update the profile_pic column in users table
    const { error: dbError } = await supabase
      .from('users')
      .update({ profile_pic: publicUrl })
      .eq('id', user.id);

    if (dbError) {
      console.error("User DB update error:", dbError);
      return NextResponse.json({ error: "Failed to update profile pic in DB." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile_pic: publicUrl
    });
  } catch (error: any) {
    console.error("Avatar route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
