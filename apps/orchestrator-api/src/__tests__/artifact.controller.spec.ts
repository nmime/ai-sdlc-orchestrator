import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtifactController } from '../artifact.controller';

const mockPresignedPut = vi.fn().mockResolvedValue('https://minio/presigned-put');
const mockPresignedGet = vi.fn().mockResolvedValue('https://minio/presigned-get');

vi.mock('minio', () => ({
  Client: class {
    presignedPutObject = mockPresignedPut;
    presignedGetObject = mockPresignedGet;
  },
}));

function createMockEm(overrides: Record<string, unknown> = {}) {
  const em = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findOneOrFail: vi.fn(),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    persist: vi.fn().mockReturnThis(),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    getReference: vi.fn((_: any, id: string) => ({ id })),
    fork: vi.fn(),
    ...overrides,
  } as any;
  em.fork.mockReturnValue(em);
  return em;
}

const mockConfig = {
  get: (key: string) => {
    const map: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost', MINIO_PORT: '9000', MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'artifacts', MINIO_PRESIGNED_TTL_SECONDS: '3600',
    };
    return map[key];
  },
};

describe('ArtifactController', () => {
  let em: ReturnType<typeof createMockEm>;
  let controller: ArtifactController;
  const mockReq = { user: { tenantId: 't-1', id: 'u-1', role: 'admin' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    em = createMockEm();
    controller = new ArtifactController(em, mockConfig as any);
  });

  describe('getPresignedUpload', () => {
    it('creates artifact and returns presigned URL', async () => {
      em.findOneOrFail.mockResolvedValueOnce({ id: 'wf-1' });
      const result = await controller.getPresignedUpload(mockReq, {
        workflowId: 'wf-abc', tenantId: 't-1', kind: 'diff_patch' as any,
        title: 'My Patch', filename: 'patch.diff',
      });
      expect(result.uploadUrl).toBe('https://minio/presigned-put');
      expect(result.artifactId).toBeDefined();
      expect(em.persistAndFlush).toHaveBeenCalled();
    });

    it('throws if tenant mismatch', async () => {
      await expect(
        controller.getPresignedUpload(mockReq, {
          workflowId: 'wf-1', tenantId: 'other-tenant', kind: 'diff_patch' as any,
          title: 'test', filename: 'test.txt',
        }),
      ).rejects.toThrow('Cannot create artifacts for another tenant');
    });

    it('throws if no tenant context', async () => {
      await expect(
        controller.getPresignedUpload({ user: {} } as any, {
          workflowId: 'wf-1', tenantId: 't-1', kind: 'diff_patch' as any,
          title: 'test', filename: 'test.txt',
        }),
      ).rejects.toThrow('Tenant context required');
    });
  });

  describe('publishArtifact', () => {
    it('publishes artifact', async () => {
      const artifact = { id: 'a-1', status: 'draft' };
      em.findOneOrFail.mockResolvedValueOnce(artifact);
      const result = await controller.publishArtifact(mockReq, 'a-1');
      expect(result.status).toBe('published');
      expect(artifact.status).toBe('published');
      expect(em.flush).toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl', () => {
    it('returns presigned download URL', async () => {
      em.findOneOrFail.mockResolvedValueOnce({ id: 'a-1', uri: 's3://artifacts/wf-1/a-1/file.txt' });
      const result = await controller.getDownloadUrl(mockReq, 'a-1');
      expect(result.downloadUrl).toBe('https://minio/presigned-get');
      expect(mockPresignedGet).toHaveBeenCalledWith('artifacts', 'wf-1/a-1/file.txt', 3600);
    });
  });
});
