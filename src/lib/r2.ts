import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, GetObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// We wrap the client creation in a function so it evaluates AT RUNTIME, 
// guaranteeing Next.js has loaded the .env variables.
function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_PUBLIC_ENDPOINT;

  // This will print to your IDE terminal so we can see exactly what is missing
  console.log("--- DEBUG R2 CREDENTIALS ---");
  console.log("Account ID exists?", !!accountId);
  console.log("Access Key exists?", !!accessKeyId);
  console.log("Secret Key exists?", !!secretAccessKey);
  console.log("Endpoint exists?", !!endpoint);
  console.log("----------------------------");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("SERVER ERROR: R2 Credentials are still missing from process.env!");
  }

  const finalEndpoint = endpoint && endpoint.includes('r2.cloudflarestorage')
    ? endpoint
    : `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint: finalEndpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
}

export async function uploadFileToR2(fileBuffer: Buffer | Uint8Array, fileName: string, mimeType: string) {
  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  return await s3Client.send(command);
}

export async function deleteFileFromR2(fileName: string) {
  const s3Client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileName,
  });

  return await s3Client.send(command);
}

export async function getSignedUrlForR2(fileName: string) {
  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileName,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function getSignedUrlForR2Download(
  objectKey: string,
  originalFilename: string,
  mimeType?: string
) {
  const s3Client = getS3Client();

  // RFC 6266 / RFC 5987 compliant Content-Disposition:
  // - filename="..."  : fallback for old browsers, must be ASCII-safe (encode spaces)
  // - filename*=UTF-8''...  : full RFC 5987 encoding for modern browsers
  const asciiFallback = originalFilename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const rfc5987Encoded = encodeURIComponent(originalFilename)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");

  const disposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987Encoded}`;

  const commandInput: GetObjectCommandInput = {
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: objectKey,
    ResponseContentDisposition: disposition,
    ...(mimeType ? { ResponseContentType: mimeType } : {}),
  };

  const command = new GetObjectCommand(commandInput);
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
