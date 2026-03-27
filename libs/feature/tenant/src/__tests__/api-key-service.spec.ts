import { ApiKeyService } from '../api-key.service';

describe('ApiKeyService', () => {
  function buildService(overrides: Record<string, any> = {}) {
    const em = {
      getReference: vi.fn().mockReturnValue({ id: 'tenant-1' }),
      persistAndFlush: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn(),
      nativeDelete: vi.fn().mockResolvedValue(1),
      ...overrides,
    } as any;
    const logger = { setContext: vi.fn(), log: vi.fn() } as any;
    return { service: new ApiKeyService(em, logger), em };
  }

  beforeEach(() => vi.clearAllMocks());

  describe('generate', () => {
    it('should generate a key with asdlc_ prefix and return hash id', async () => {
      const { service, em } = buildService();
      const result = await service.generate('tenant-1', 'prod-key');
      expect(result.isOk()).toBe(true);
      const { key, id } = result._unsafeUnwrap();
      expect(key).toMatch(/^asdlc_[0-9a-f]{64}$/);
      expect(id).toBeDefined();
      expect(em.persistAndFlush).toHaveBeenCalled();
    });

    it('should generate with custom role', async () => {
      const { service } = buildService();
      const result = await service.generate('tenant-1', 'admin-key', 'admin' as any);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate a valid key', async () => {
      const mockKey = { keyHash: 'abc', expiresAt: null, tenant: { id: 't-1' } };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockKey) });
      const result = await service.validate('some-raw-key');
      expect(result.isOk()).toBe(true);
    });

    it('should return UNAUTHORIZED for unknown key', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.validate('bad-key');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('UNAUTHORIZED');
    });

    it('should return UNAUTHORIZED for expired key', async () => {
      const mockKey = { keyHash: 'abc', expiresAt: new Date('2020-01-01'), tenant: { id: 't-1' } };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockKey) });
      const result = await service.validate('expired-key');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('UNAUTHORIZED');
      expect(result._unsafeUnwrapErr().message).toContain('expired');
    });

    it('should accept non-expired key with future expiresAt', async () => {
      const mockKey = { keyHash: 'abc', expiresAt: new Date('2099-12-31'), tenant: { id: 't-1' } };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockKey) });
      const result = await service.validate('valid-key');
      expect(result.isOk()).toBe(true);
    });
  });

  describe('revoke', () => {
    it('should revoke an existing key', async () => {
      const { service, em } = buildService();
      const result = await service.revoke('key-1');
      expect(result.isOk()).toBe(true);
      expect(em.nativeDelete).toHaveBeenCalled();
    });

    it('should return NOT_FOUND when key does not exist', async () => {
      const { service } = buildService({ nativeDelete: vi.fn().mockResolvedValue(0) });
      const result = await service.revoke('missing');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });
  });
});
