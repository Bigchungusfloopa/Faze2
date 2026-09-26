import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Provider-agnostic object storage over the S3 API.
//
// Real AWS S3 when APP_S3_ENDPOINT is unset. Any S3-compatible host (Cloudflare
// R2, MinIO, ...) when it is set. The provider is a config decision, not a code
// one, so nothing here is named after a vendor.
//
// Env vars are prefixed APP_S3_ rather than AWS_ on purpose: AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY and AWS_REGION are reserved by the Lambda runtime that
// Vercel functions execute on, and the platform overwrites them with its own
// execution-role values.

const SIGNED_URL_TTL_SECONDS = 3600;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const region = process.env.APP_S3_REGION;
  const accessKeyId = process.env.APP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.APP_S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.APP_S3_ENDPOINT || undefined;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage is not configured: APP_S3_REGION, APP_S3_ACCESS_KEY_ID and APP_S3_SECRET_ACCESS_KEY are required."
    );
  }

  client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return client;
}

function bucket(): string {
  const name = process.env.APP_S3_BUCKET;
  if (!name) throw new Error("Object storage is not configured: APP_S3_BUCKET is required.");
  return name;
}

export async function putObject(body: Buffer | Uint8Array, key: string, contentType: string) {
  return getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType })
  );
}

export async function deleteObject(key: string) {
  return getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Fetches the whole object into memory. Used by the ingestion pipeline. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`Object ${key} has no body`);
  return res.Body.transformToByteArray();
}

/** Presigned GET for viewing inline (browser decides how to render). */
export async function getViewUrl(key: string) {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}

/** Presigned GET that forces a download with the original filename. */
export async function getDownloadUrl(key: string, originalFilename: string, mimeType?: string) {
  // RFC 6266 / RFC 5987 compliant Content-Disposition:
  // - filename="..."  : fallback for old browsers, must be ASCII-safe (encode spaces)
  // - filename*=UTF-8''...  : full RFC 5987 encoding for modern browsers
  const asciiFallback = originalFilename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const rfc5987Encoded = encodeURIComponent(originalFilename)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");

  const disposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987Encoded}`;

  const input: GetObjectCommandInput = {
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: disposition,
    ...(mimeType ? { ResponseContentType: mimeType } : {}),
  };

  return getSignedUrl(getClient(), new GetObjectCommand(input), { expiresIn: SIGNED_URL_TTL_SECONDS });
}

/**
 * Presigned PUT so the browser uploads straight to the bucket. Sidesteps the
 * serverless request-body ceiling (~4.5 MB) that the multipart upload route
 * only survives by luck.
 */
export async function getUploadUrl(key: string, contentType: string, ttlSeconds = 900) {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: ttlSeconds }
  );
}
