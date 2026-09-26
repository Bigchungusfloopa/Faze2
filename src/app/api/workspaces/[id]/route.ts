import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/** Delete a community (Admins only -- enforced inside delete_workspace()). */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("delete_workspace", { p_workspace_id: id });
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  // The rows are gone; remove their files. A failure here only leaves an
  // orphaned object behind, so log it rather than fail the request.
  const keys = ((data ?? []) as Array<{ storage_key: string }>).map((r) => r.storage_key);
  const results = await Promise.allSettled(keys.map((k) => deleteObject(k)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("community delete: failed to remove", keys[i], r.reason);
  });

  return NextResponse.json({ ok: true, filesRemoved: keys.length });
}
