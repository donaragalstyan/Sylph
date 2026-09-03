import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_CONTENT_TYPES = Object.keys(CONTENT_TYPE_EXTENSIONS);
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
}

/**
 * Issues a short-lived, signed PUT URL for a single image upload. The key is scoped under the
 * owning user's id so ownership is structurally clear from the key alone; `ContentLength` is
 * baked into the signature, so the client's PUT must send exactly this many bytes or the
 * signature is invalid. See docs/PRODUCT_AND_COMPLIANCE.md §3/§8.
 */
export async function presignClosetItemImageUpload(
  ownerId: string,
  contentType: string,
  byteSize: number,
): Promise<PresignedUpload> {
  const extension = CONTENT_TYPE_EXTENSIONS[contentType];
  if (!extension) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const storageKey = `closet-items/${ownerId}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    ContentType: contentType,
    ContentLength: byteSize,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return {
    uploadUrl,
    storageKey,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
  };
}

/** Signed, time-limited GET URL — the only way an image is ever read. No object is public. */
export async function presignClosetItemImageDownload(storageKey: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/** Best-effort delete — the database row is the source of truth for whether an image "exists"
 * from the user's perspective; a failure here leaves an orphaned object, not a consistency bug. */
export async function deleteStorageObject(storageKey: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
  } catch (err) {
    console.error(`Failed to delete storage object ${storageKey}`, err);
  }
}

/** Idempotent — called once at server boot so local/dev environments self-heal without a
 * separate provisioning step. In production the bucket is expected to already exist. */
export async function ensureBucketExists(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}
