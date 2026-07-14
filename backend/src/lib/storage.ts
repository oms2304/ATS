import 'dotenv/config';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export class StorageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageServiceError';
  }
}

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new StorageServiceError('Storage is not configured');
  }
  return createClient(url, key);
}

async function createSignedUrl(path: string): Promise<string> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new StorageServiceError(
      `Failed to generate file URL: ${error?.message ?? 'unknown error'}`
    );
  }
  return data.signedUrl;
}

export async function ensureBucketExists(): Promise<void> {
  const client = getStorageClient();
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) {
    throw new StorageServiceError(
      `Storage listBuckets failed: ${error.message}`
    );
  }
  const exists = buckets?.some((bucket) => bucket.name === BUCKET);
  if (!exists) {
    const { error: createError } = await client.storage.createBucket(BUCKET, {
      public: false,
    });
    if (createError && createError.message !== 'Bucket already exists') {
      throw new StorageServiceError(
        `Storage createBucket failed: ${createError.message}`
      );
    }
  }
}

export type UploadedFileReference = {
  path: string;
  signedUrl: string;
};

export async function uploadFile(
  userId: string,
  _fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadedFileReference> {
  const path = `${userId}/${randomUUID()}`;
  const { error } = await getStorageClient()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new StorageServiceError(`Storage upload failed: ${error.message}`);
  }

  return { path, signedUrl: await createSignedUrl(path) };
}

export function parseOwnedObjectPath(
  reference: string,
  userId: string
): string {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new StorageServiceError('Stored file reference is empty');
  }

  let encodedPath: string;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:sign|public|authenticated)\/documents\/(.+)$/
    );
    if (!match?.[1]) {
      throw new StorageServiceError('Stored file URL has an invalid path');
    }
    encodedPath = match[1];
  } catch (error) {
    if (error instanceof StorageServiceError) throw error;
    encodedPath = trimmed.startsWith(`${BUCKET}/`)
      ? trimmed.slice(BUCKET.length + 1)
      : trimmed;
  }

  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    throw new StorageServiceError('Stored file reference is malformed');
  }

  if (path.includes('\\')) {
    throw new StorageServiceError('Stored file reference is malformed');
  }
  const segments = path.split('/');
  if (
    segments.length < 2 ||
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..'
    ) ||
    segments[0] !== userId
  ) {
    throw new StorageServiceError('Stored file does not belong to this user');
  }
  return segments.join('/');
}

export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await getStorageClient()
    .storage.from(BUCKET)
    .download(path);
  if (error || !data) {
    throw new StorageServiceError(
      `Storage download failed: ${error?.message ?? 'empty response'}`
    );
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function copyObject(
  userId: string,
  fromPath: string
): Promise<UploadedFileReference> {
  const path = `${userId}/${randomUUID()}`;
  const { error } = await getStorageClient()
    .storage.from(BUCKET)
    .copy(fromPath, path);
  if (error) {
    throw new StorageServiceError(`Storage copy failed: ${error.message}`);
  }
  return { path, signedUrl: await createSignedUrl(path) };
}

export async function deleteObject(path: string): Promise<void> {
  const { error } = await getStorageClient()
    .storage.from(BUCKET)
    .remove([path]);
  if (error) {
    throw new StorageServiceError(`Storage delete failed: ${error.message}`);
  }
}
