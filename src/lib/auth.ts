import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared across src/actions/vault.ts and the RAG routes so authorization
 * logic exists in one place rather than being reimplemented per route.
 *
 * Not exported from a "use server" file: it takes a Supabase client argument,
 * and Next.js treats every export of a "use server" file as a Server Action
 * reference with a serializable-argument contract, which a client object
 * cannot satisfy.
 */
export async function requireUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}
