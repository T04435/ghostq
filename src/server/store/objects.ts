import "server-only";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/server/env";

/**
 * Neon Object Storage (S3-compatible, beta as of 21 Oct 2026), bucket `ghostq-audio` on the project's main branch.
 * Per Neon's docs: path-style addressing, and checksums only when required.
 */
let client: S3Client | null = null;

function s3(): S3Client {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_ENDPOINT_URL_S3) throw new Error("Neon Object Storage isn't configured");
  client ??= new S3Client({
    region: env.AWS_REGION ?? "us-east-1",
    endpoint: env.AWS_ENDPOINT_URL_S3,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

function bucket(): string {
  if (!env.NEON_STORAGE_BUCKET) throw new Error("NEON_STORAGE_BUCKET isn't set");
  return env.NEON_STORAGE_BUCKET;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    const out = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null;
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}
