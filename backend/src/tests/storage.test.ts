import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const bucket = {
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    download: vi.fn(),
    copy: vi.fn(),
    remove: vi.fn(),
  };
  const storage = {
    from: vi.fn(() => bucket),
    listBuckets: vi.fn(),
    createBucket: vi.fn(),
  };
  return { bucket, storage, createClient: vi.fn(() => ({ storage })) };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

import {
  StorageServiceError,
  copyObject,
  downloadObject,
  parseOwnedObjectPath,
  uploadFile,
} from '../lib/storage';

describe('storage path ownership and object operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://devproject.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    mocks.bucket.upload.mockResolvedValue({ error: null });
    mocks.bucket.copy.mockResolvedValue({ error: null });
    mocks.bucket.remove.mockResolvedValue({ error: null });
    mocks.bucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://devproject.supabase.co/signed-file' },
      error: null,
    });
  });

  it('parses legacy signed, public, and raw paths for the owning user', () => {
    expect(
      parseOwnedObjectPath(
        'https://devproject.supabase.co/storage/v1/object/sign/documents/user-1/file-id?token=abc',
        'user-1'
      )
    ).toBe('user-1/file-id');
    expect(
      parseOwnedObjectPath(
        'https://devproject.supabase.co/storage/v1/object/public/documents/user-1/file-id',
        'user-1'
      )
    ).toBe('user-1/file-id');
    expect(parseOwnedObjectPath('user-1/file-id', 'user-1')).toBe(
      'user-1/file-id'
    );
  });

  it('rejects cross-user, traversal, and malformed paths', () => {
    expect(() =>
      parseOwnedObjectPath('another-user/file-id', 'user-1')
    ).toThrow(StorageServiceError);
    expect(() =>
      parseOwnedObjectPath('user-1/%2e%2e/file-id', 'user-1')
    ).toThrow(StorageServiceError);
    expect(() => parseOwnedObjectPath('%E0%A4%A', 'user-1')).toThrow(
      StorageServiceError
    );
  });

  it('returns both a stable path and signed URL after upload', async () => {
    const result = await uploadFile(
      'user-1',
      'resume.pdf',
      Buffer.from('pdf'),
      'application/pdf'
    );

    expect(result.path).toMatch(/^user-1\//);
    expect(result.signedUrl).toBe('https://devproject.supabase.co/signed-file');
    expect(mocks.bucket.upload).toHaveBeenCalledWith(
      result.path,
      expect.any(Buffer),
      { contentType: 'application/pdf', upsert: false }
    );
  });

  it('copies to a new independent path and signs it', async () => {
    const result = await copyObject('user-1', 'user-1/original');
    expect(result.path).toMatch(/^user-1\//);
    expect(result.path).not.toBe('user-1/original');
    expect(mocks.bucket.copy).toHaveBeenCalledWith(
      'user-1/original',
      result.path
    );
    expect(result.signedUrl).toContain('signed-file');
  });

  it('downloads object bytes', async () => {
    mocks.bucket.download.mockResolvedValue({
      data: new Blob(['stored bytes']),
      error: null,
    });
    await expect(downloadObject('user-1/file')).resolves.toEqual(
      Buffer.from('stored bytes')
    );
  });

  it('fails lazily when storage configuration is missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(
      uploadFile('user-1', 'resume.pdf', Buffer.from('pdf'), 'application/pdf')
    ).rejects.toThrow('Storage is not configured');
  });
});
