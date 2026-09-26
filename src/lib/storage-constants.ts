// Shared between the server (src/lib/storage.ts, via the admin client) and
// the browser (UploadDropzone, via the signed-upload-URL flow) -- both need
// to name the same bucket when calling the Supabase Storage SDK, so this is
// a plain constant rather than an env var read twice with room to drift.
export const STORAGE_BUCKET = "faze-files";
