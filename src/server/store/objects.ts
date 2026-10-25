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

/**
 * An object as a stream, optionally one byte range ("bytes=0-1023"), so audio starts playing while the rest arrives and
 * seeking only fetches what it needs. Null when the object doesn't exist.
 */
export async function getObjectStream(key: string, range?: string | null): Promise<{ body: ReadableStream; length?: number; contentRange?: string; total?: number } | null> {
  try {
    const out = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key, ...(range ? { Range: range } : {}) }));
    if (!out.Body) return null;
    const total = out.ContentRange ? Number(out.ContentRange.split("/")[1]) : out.ContentLength;
    return { body: out.Body.transformToWebStream(), length: out.ContentLength, contentRange: out.ContentRange, total };
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    if (error && typeof error === "object" && "name" in error && error.name === "InvalidRange") return null;
    throw error;
  }
}
