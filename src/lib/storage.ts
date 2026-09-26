import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage-constants";

// Object storage on Supabase Storage, replacing the earlier S3/R2 layer.
// Every function here runs through the admin (secret-key) client, which
// bypasses RLS and Storage policies entirely -- callers are responsible for
// checking ownership/authorization before calling any of these, exactly as
// they were with the S3 version. The bucket is private (no public policy);
// every read is a signed URL minted here, server-side, after that check.

const SIGNED_URL_TTL_SECONDS = 3600;

function bucket() {
  return createAdminClient().storage.from(STORAGE_BUCKET);
}

/** Server-side upload of bytes already in memory. Used by the vault's multipart upload route. */
export async function putObject(body: Uint8Array, key: string, contentType: string) {
  const { error } = await bucket().upload(key, Buffer.from(body), { contentType, upsert: false });
  if (error) throw error;
}

export async function deleteObject(key: string) {
  const { error } = await bucket().remove([key]);
  if (error) throw error;
}

export async function objectExists(key: string): Promise<boolean> {
  const dir = key.split("/").slice(0, -1).join("/");
  const name = key.split("/").pop()!;
  const { data, error } = await bucket().list(dir, { search: name });
  if (error) return false;
  return !!data?.some((f) => f.name === name);
}

/** Fetches the whole object into memory. Used by the ingestion pipeline. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const { data, error } = await bucket().download(key);
  if (error || !data) throw error ?? new Error(`Object ${key} not found`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Signed GET for viewing inline. */
export async function getViewUrl(key: string): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error("Failed to create signed URL");
  return data.signedUrl;
}

/**
 * Signed GET that forces a download with the given filename. Supabase
 * Storage's `download` option sets Content-Disposition itself -- the manual
 * RFC 6266/5987 header construction the S3 version needed is gone.
 */
export async function getDownloadUrl(key: string, filename: string): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(key, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (error || !data) throw error ?? new Error("Failed to create signed URL");
  return data.signedUrl;
}

/**
 * A signed upload token for the browser to PUT bytes directly to the bucket,
 * bypassing the server entirely. Unlike an S3 presigned PUT, the client must
 * use the Supabase Storage SDK's `uploadToSignedUrl(path, token, file)` to
 * consume this -- the wire format wraps the body in a way a raw fetch PUT to
 * `signedUrl` does not replicate correctly, so only `path` and `token` are
 * returned; the browser never needs the raw `signedUrl` itself.
 */
export async function getUploadToken(key: string): Promise<{ path: string; token: string }> {
  const { data, error } = await bucket().createSignedUploadUrl(key);
  if (error || !data) throw error ?? new Error("Failed to create signed upload URL");
  return { path: data.path, token: data.token };
}
