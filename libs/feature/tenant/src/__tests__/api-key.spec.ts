import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../api-key.service';
import { createHash } from 'crypto';

function createMockEm(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    getReference: vi.fn((_: any, id: string) => ({ id })),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    nativeDelete: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as any;
}

function createMockLogger() {
  return { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let em: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    em = createMockEm();
    service = new ApiKeyService(em, createMockLogger());
  });

  describe('generate', () => {
    it('generates key with asdlc_ prefix', async () => {
      const result = await service.generate('tenant-1', 'my-key');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.key).toMatch(/^asdlc_[0-9a-f]{64}$/);
        expect(result.value.id).toBeDefined();
      }
    });

    it('stores hashed key (not raw)', async () => {
      const result = await service.generate('tenant-1', 'my-key');
      expect(result.isOk()).toBe(true);
      const persistCall = em.persistAndFlush.mock.calls[0][0];
      if (result.isOk()) {
        const expectedHash = createHash('sha256').update(result.value.key).digest('hex');
        expect(persistCall.keyHash).toBe(expectedHash);
      }
    });

    it('generates unique keys', async () => {
      const r1 = await service.generate('t1', 'k1');
      const r2 = await service.generate('t1', 'k2');
      expect(r1.isOk() && r2.isOk()).toBe(true);
      if (r1.isOk() && r2.isOk()) {
        expect(r1.value.key).not.toBe(r2.value.key);
      }
    });
  });

  describe('validate', () => {
    it('returns UNAUTHORIZED for unknown key', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.validate('asdlc_unknown');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.message).toBe('Invalid API key');
    });

    it('finds key by hash', async () => {
      const rawKey = 'asdlc_test123';
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const mockApiKey = { id: 'k1', keyHash, name: 'test', tenant: { id: 't1' }, expiresAt: null };
      em.findOne.mockResolvedValueOnce(mockApiKey);
      const result = await service.validate(rawKey);
      expect(result.isOk()).toBe(true);
      expect(em.findOne).toHaveBeenCalledWith(expect.anything(), { keyHash }, expect.anything());
    });

    it('rejects expired API key', async () => {
      const rawKey = 'asdlc_expired';
      const pastDate = new Date(Date.now() - 86400000);
      em.findOne.mockResolvedValueOnce({
        id: 'k1', keyHash: createHash('sha256').update(rawKey).digest('hex'),
        name: 'old-key', tenant: { id: 't1' }, expiresAt: pastDate,
      });
      const result = await service.validate(rawKey);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.message).toBe('API key expired');
    });

    it('accepts non-expired API key with future expiresAt', async () => {
      const rawKey = 'asdlc_valid';
      const futureDate = new Date(Date.now() + 86400000);
      em.findOne.mockResolvedValueOnce({
        id: 'k1', keyHash: createHash('sha256').update(rawKey).digest('hex'),
        name: 'valid-key', tenant: { id: 't1' }, expiresAt: futureDate,
      });
      const result = await service.validate(rawKey);
      expect(result.isOk()).toBe(true);
    });

    it('accepts API key with null expiresAt (no expiration)', async () => {
      const rawKey = 'asdlc_forever';
      em.findOne.mockResolvedValueOnce({
        id: 'k1', keyHash: createHash('sha256').update(rawKey).digest('hex'),
        name: 'permanent', tenant: { id: 't1' }, expiresAt: null,
      });
      const result = await service.validate(rawKey);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('revoke', () => {
    it('deletes key scoped to tenant', async () => {
      em.nativeDelete.mockResolvedValueOnce(1);
      const result = await service.revoke('tenant-1', 'key-1');
      expect(result.isOk()).toBe(true);
      expect(em.nativeDelete).toHaveBeenCalledWith(expect.anything(), { id: 'key-1', tenant: 'tenant-1' });
    });

    it('returns NOT_FOUND when key does not exist', async () => {
      em.nativeDelete.mockResolvedValueOnce(0);
      const result = await service.revoke('tenant-1', 'nonexistent');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('prevents cross-tenant deletion', async () => {
      em.nativeDelete.mockResolvedValueOnce(0);
      const result = await service.revoke('other-tenant', 'key-1');
      expect(result.isErr()).toBe(true);
    });
  });
});
