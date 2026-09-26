import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The one place a secret-key (RLS-bypassing) Supabase client is constructed.
//
// Every caller must have ALREADY authenticated the user with the cookie client
// and checked authorization in application code -- this client will not do it.
// Prefer the cookie client from ./server wherever RLS can do the work.

if (typeof window !== "undefined") {
  throw new Error("createAdminClient must never be imported into client-side code.");
}

let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }

  admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
