import {
  DeleteObjectsCommand,
  GetObjectCommand,
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
