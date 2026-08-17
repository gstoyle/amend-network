import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let client: S3Client | undefined;

export function s3Client(): S3Client {
  if (!client) {
    const settings = env();
    client = new S3Client({
      region: settings.S3_REGION,
      endpoint: settings.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: settings.S3_ACCESS_KEY_ID,
        secretAccessKey: settings.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function resetStorageClient(): void {
  client = undefined;
}

function bucket(): string {
  return env().S3_BUCKET;
}

export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function getObjectBytes(key: string): Promise<Buffer | null> {
  try {
    const result = await s3Client().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    if (!result.Body) {
      return null;
    }
    return Buffer.from(await result.Body.transformToByteArray());
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") {
      return null;
    }
    throw error;
  }
}

export async function presignGet(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await s3Client().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      CopySource: `${bucket()}/${sourceKey}`,
      Key: destKey,
    }),
  );
}

export async function promoteObject(sourceKey: string, destKey: string): Promise<void> {
  await copyObject(sourceKey, destKey);
  await deleteObject(sourceKey);
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
