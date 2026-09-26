import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; userId: string }> };

const ROLES = new Set(["owner", "member", "viewer"]);

/** Change a member's role (Admins only; the last Admin can't be demoted). */
export async function PATCH(request: Request, { params }: Params) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (await request.json().catch(() => null))?.role;
  if (typeof role !== "string" || !ROLES.has(role)) {
    return NextResponse.json({ error: "role must be owner, member or viewer." }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_member_role", { p_workspace_id: id, p_user_id: userId, p_role: role });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

/** Remove a member (Admins), or leave the community (userId = yourself). */
export async function DELETE(_request: Request, { params }: Params) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("remove_member", { p_workspace_id: id, p_user_id: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
