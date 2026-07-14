import 'dotenv/config';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    realtime: {
      transport: WebSocket as any,
    },
  }
);

const BUCKET = 'documents';

export async function ensureBucketExists() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Storage listBuckets failed: ${error.message}`);
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: false });
    if (createError && createError.message !== 'Bucket already exists') {
      throw new Error(`Storage createBucket failed: ${createError.message}`);
    }
  }
}

export async function uploadFile(
  userId: string,
  _fileName: string,
  buffer: Buffer,
  mimeType: string
) {
  const path = `${userId}/${randomUUID()}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 day expiry
  if (signError || !data) throw new Error(`Failed to generate file URL: ${signError?.message}`);
  return data.signedUrl;
}
