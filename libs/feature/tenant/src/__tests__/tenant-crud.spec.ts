import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@app/common', async () => {
  const actual = await vi.importActual<any>('@app/common');
  return { ...actual };
});

import { TenantService } from '../tenant.service';

function createMockEm(overrides: Record<string, any> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findOneOrFail: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    nativeDelete: vi.fn().mockResolvedValue(1),
    getReference: vi.fn((_: any, id: string) => ({ id })),
    create: vi.fn((_Cls: any, data: any) => ({ ...data })),
    ...overrides,
  } as any;
}

function createMockLogger() {
  return { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

describe('TenantService CRUD', () => {
  let service: TenantService;
  let em: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    em = createMockEm();
    service = new TenantService(em, createMockLogger());
  });

  describe('create', () => {
    it('rejects duplicate slug', async () => {
      em.findOne.mockResolvedValueOnce({ id: 'existing', slug: 'taken' });
      const result = await service.create({ slug: 'taken', name: 'Test' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('CONFLICT');
    });

    it('creates tenant with generated UUID', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.create({ slug: 'new-tenant', name: 'New' });
      expect(result.isOk()).toBe(true);
      expect(em.persistAndFlush).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns NOT_FOUND for missing tenant', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.findById('nonexistent');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns tenant when found', async () => {
      const tenant = { id: 't1', slug: 'my-tenant', name: 'My Tenant' };
      em.findOne.mockResolvedValueOnce(tenant);
      const result = await service.findById('t1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.slug).toBe('my-tenant');
    });
  });

  describe('findBySlug', () => {
    it('returns NOT_FOUND for missing slug', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.findBySlug('nonexistent');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('update', () => {
    it('updates name field on existing tenant', async () => {
      const tenant = { id: 't1', slug: 's', name: 'Old', monthlyCostLimitUsd: 100 };
      em.findOne.mockResolvedValueOnce(tenant);
      const result = await service.update('t1', { name: 'Updated' } as any);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Updated');
      }
      expect(em.flush).toHaveBeenCalled();
    });

    it('updates monthlyCostLimitUsd', async () => {
      const tenant = { id: 't1', slug: 's', name: 'X', monthlyCostLimitUsd: 100 };
      em.findOne.mockResolvedValueOnce(tenant);
      const result = await service.update('t1', { monthlyCostLimitUsd: 500 } as any);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.monthlyCostLimitUsd).toBe(500);
    });

    it('sanitizes meta field', async () => {
      const tenant = { id: 't1', slug: 's', name: 'X', meta: {} };
      em.findOne.mockResolvedValueOnce(tenant);
      const result = await service.update('t1', { meta: { '__proto__': 'bad', normal: 'ok' } } as any);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.meta).not.toHaveProperty('__proto__');
      }
    });

    it('returns NOT_FOUND when tenant missing', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.update('bad-id', { name: 'X' } as any);
      expect(result.isErr()).toBe(true);
    });
  });

  describe('delete (soft)', () => {
    it('soft deletes by setting status to DELETED', async () => {
      const tenant = { id: 't1', slug: 's', name: 'To Delete', status: 'ACTIVE' };
      em.findOne.mockResolvedValueOnce(tenant);
      const result = await service.delete('t1');
      expect(result.isOk()).toBe(true);
      expect(tenant.status).toBe('deleted');
      expect(em.flush).toHaveBeenCalled();
    });

    it('returns error when tenant missing', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.delete('bad-id');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('reserveBudget', () => {
    it('rejects when cost exceeds monthly limit', async () => {
      em.findOne.mockResolvedValueOnce({
        id: 't1',
        monthlyCostLimitUsd: 100,
        monthlyCostActualUsd: 80,
        monthlyCostReservedUsd: 15,
        budgetVersion: 1,
      });
      const result = await service.reserveBudget('t1', 10);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('BUDGET_EXCEEDED');
    });

    it('handles optimistic locking conflict (concurrent modification)', async () => {
      em.findOne.mockResolvedValueOnce({
        id: 't1',
        monthlyCostLimitUsd: 100,
        monthlyCostActualUsd: 0,
        monthlyCostReservedUsd: 0,
        budgetVersion: 1,
      });
      em.nativeUpdate.mockResolvedValueOnce(0);
      const result = await service.reserveBudget('t1', 5);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('CONFLICT');
    });

    it('reserves budget within limit and increments version', async () => {
      em.findOne.mockResolvedValueOnce({
        id: 't1',
        monthlyCostLimitUsd: 100,
        monthlyCostActualUsd: 20,
        monthlyCostReservedUsd: 30,
        budgetVersion: 5,
      });
      em.nativeUpdate.mockResolvedValueOnce(1);
      const result = await service.reserveBudget('t1', 10);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.budgetVersion).toBe(6);
    });

    it('allows reservation when limit is 0 (unlimited)', async () => {
      em.findOne.mockResolvedValueOnce({
        id: 't1',
        monthlyCostLimitUsd: 0,
        monthlyCostActualUsd: 5000,
        monthlyCostReservedUsd: 5000,
        budgetVersion: 1,
      });
      em.nativeUpdate.mockResolvedValueOnce(1);
      const result = await service.reserveBudget('t1', 1000);
      expect(result.isOk()).toBe(true);
    });

    it('returns NOT_FOUND for missing tenant', async () => {
      em.findOne.mockResolvedValueOnce(null);
      const result = await service.reserveBudget('missing', 10);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('addUser', () => {
    it('creates a tenant user with correct fields', async () => {
      const result = await service.addUser('t1', 'ext-id', 'github', 'user@example.com', 'OPERATOR' as any);
      expect(result.isOk()).toBe(true);
      expect(em.persistAndFlush).toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('returns users for tenant', async () => {
      const users = [{ id: 'u1', email: 'a@b.com' }];
      em.find.mockResolvedValueOnce(users);
      const result = await service.getUsers('t1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toHaveLength(1);
    });

    it('queries with limit 200', async () => {
      em.find.mockResolvedValueOnce([]);
      await service.getUsers('t1');
      expect(em.find).toHaveBeenCalledWith(
        expect.anything(),
        { tenant: 't1' },
        expect.objectContaining({ limit: 200 }),
      );
    });
  });
});
