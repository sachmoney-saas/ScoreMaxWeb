import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectIdentifier,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Env } from "./env";

const r2Env = getR2Env();

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${r2Env.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2Env.accessKeyId,
    secretAccessKey: r2Env.secretAccessKey,
  },
});

export function getDefaultR2Bucket(): string {
  return r2Env.bucket;
}

export function getR2SignedUploadUrl(params: {
  bucket?: string;
  key: string;
  contentType: "image/jpeg" | "image/png";
  expiresInSeconds?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
  });
}

export async function downloadR2Object(params: {
  bucket?: string;
  key: string;
}): Promise<Blob> {
  const command = new GetObjectCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Key: params.key,
  });
  const response = await r2Client.send(command);
  if (!response.Body) {
    throw new Error("R2 object body is empty");
  }

  return new Blob([await response.Body.transformToByteArray()]);
}

export async function uploadR2Object(params: {
  bucket?: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  });
  await r2Client.send(command);
}

export function getR2SignedDownloadUrl(params: {
  bucket?: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Key: params.key,
  });
  return getSignedUrl(r2Client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
  });
}

/**
 * Probe an R2 object without downloading its body.
 *
 * Returns `true` if the object exists, `false` for 404/NoSuchKey. Re-throws on
 * unrelated errors (credentials, network, etc.) so callers can decide whether
 * to retry or fall back silently.
 */
export async function r2ObjectExists(params: {
  bucket?: string;
  key: string;
}): Promise<boolean> {
  const command = new HeadObjectCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Key: params.key,
  });
  try {
    await r2Client.send(command);
    return true;
  } catch (error: unknown) {
    const name = (error as { name?: string } | null)?.name;
    const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
      ?.$metadata?.httpStatusCode;
    if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
      return false;
    }
    throw error;
  }
}

export async function deleteR2Objects(params: {
  bucket?: string;
  keys: string[];
}): Promise<void> {
  if (params.keys.length === 0) {
    return;
  }

  const objects: ObjectIdentifier[] = params.keys.map((key) => ({ Key: key }));
  const command = new DeleteObjectsCommand({
    Bucket: params.bucket ?? r2Env.bucket,
    Delete: {
      Objects: objects,
      Quiet: true,
    },
  });
  await r2Client.send(command);
}
