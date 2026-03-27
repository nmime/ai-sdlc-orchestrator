import { TenantService } from '../tenant.service';

const TenantStatus = {
  ACTIVE: 'active',
  DELETED: 'deleted',
  SUSPENDED: 'suspended',
} as const;

const mockTenant = {
  id: 'tenant-1',
  slug: 'acme',
  name: 'Acme Corp',
  status: TenantStatus.ACTIVE,
  monthlyCostLimitUsd: 500,
  monthlyCostActualUsd: 100,
  monthlyCostReservedUsd: 50,
  budgetVersion: 3,
  createdAt: new Date(),
};

function buildService(overrides: Record<string, any> = {}) {
  const em = {
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    getReference: vi.fn().mockReturnValue({ id: 'tenant-1' }),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    nativeDelete: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as any;
  const logger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
  return { service: new TenantService(em, logger), em, logger };
}

describe('TenantService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('create', () => {
    it('should create a new tenant successfully', async () => {
      const { service, em } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.create({ slug: 'new-co', name: 'New Co' });
      expect(result.isOk()).toBe(true);
      const tenant = result._unsafeUnwrap();
      expect(tenant.slug).toBe('new-co');
      expect(tenant.name).toBe('New Co');
      expect(em.persistAndFlush).toHaveBeenCalled();
    });

    it('should apply optional fields when provided', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.create({
        slug: 'corp',
        name: 'Corp',
        monthlyCostLimitUsd: 1000,
        defaultAgentProvider: 'claude_code',
        defaultAgentModel: 'claude-4',
        meta: { tier: 'enterprise' },
      });
      expect(result.isOk()).toBe(true);
      const t = result._unsafeUnwrap();
      expect(t.monthlyCostLimitUsd).toBe(1000);
      expect(t.defaultAgentProvider).toBe('claude_code');
      expect(t.defaultAgentModel).toBe('claude-4');
      expect(t.meta).toEqual({ tier: 'enterprise' });
    });

    it('should return CONFLICT if slug already exists', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockTenant) });
      const result = await service.create({ slug: 'acme', name: 'Acme' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');
    });
  });

  describe('findById', () => {
    it('should return tenant when found', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockTenant) });
      const result = await service.findById('tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().slug).toBe('acme');
    });

    it('should return NOT_FOUND when tenant does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.findById('missing');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });
  });

  describe('findBySlug', () => {
    it('should return tenant when found by slug', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(mockTenant) });
      const result = await service.findBySlug('acme');
      expect(result.isOk()).toBe(true);
    });

    it('should return NOT_FOUND when slug does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.findBySlug('missing');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });
  });

  describe('list', () => {
    it('should return all non-deleted tenants', async () => {
      const tenants = [mockTenant, { ...mockTenant, id: 't-2', slug: 'beta' }];
      const { service } = buildService({ find: vi.fn().mockResolvedValue(tenants) });
      const result = await service.list();
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update tenant fields', async () => {
      const existing = { ...mockTenant };
      const { service, em } = buildService({ findOne: vi.fn().mockResolvedValue(existing) });
      const result = await service.update('tenant-1', {
        name: 'Acme Updated',
        monthlyCostLimitUsd: 1000,
        monthlyAiCostLimitUsd: 300,
        monthlySandboxCostLimitUsd: 200,
        defaultAgentProvider: 'openhands',
        defaultAgentModel: 'gpt-5',
        maxConcurrentWorkflows: 20,
        maxConcurrentSandboxes: 10,
        meta: { updated: true },
        status: TenantStatus.SUSPENDED as any,
      });
      expect(result.isOk()).toBe(true);
      expect(existing.name).toBe('Acme Updated');
      expect(existing.monthlyCostLimitUsd).toBe(1000);
      expect(existing.maxConcurrentWorkflows).toBe(20);
      expect(existing.maxConcurrentSandboxes).toBe(10);
      expect(em.flush).toHaveBeenCalled();
    });

    it('should return NOT_FOUND if tenant does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.update('missing', { name: 'x' });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });
  });

  describe('delete', () => {
    it('should soft-delete by setting status to DELETED', async () => {
      const existing = { ...mockTenant };
      const { service, em } = buildService({ findOne: vi.fn().mockResolvedValue(existing) });
      const result = await service.delete('tenant-1');
      expect(result.isOk()).toBe(true);
      expect(existing.status).toBe('deleted');
      expect(em.flush).toHaveBeenCalled();
    });

    it('should return NOT_FOUND if tenant does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.delete('missing');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('addUser', () => {
    it('should create a tenant user', async () => {
      const { service, em } = buildService();
      const result = await service.addUser('tenant-1', 'ext-123', 'github', 'user@test.com', 'admin' as any);
      expect(result.isOk()).toBe(true);
      const user = result._unsafeUnwrap();
      expect(user.externalId).toBe('ext-123');
      expect(user.provider).toBe('github');
      expect(user.email).toBe('user@test.com');
      expect(em.persistAndFlush).toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('should return users for a tenant', async () => {
      const users = [{ id: 'u-1', email: 'a@b.com' }];
      const { service } = buildService({ find: vi.fn().mockResolvedValue(users) });
      const result = await service.getUsers('tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(1);
    });
  });

  describe('reserveBudget', () => {
    it('should reserve budget when within limit', async () => {
      const tenant = { ...mockTenant };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(tenant) });
      const result = await service.reserveBudget('tenant-1', 10);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().budgetVersion).toBe(4);
    });

    it('should return BUDGET_EXCEEDED when over limit', async () => {
      const tenant = { ...mockTenant, monthlyCostLimitUsd: 160 };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(tenant) });
      const result = await service.reserveBudget('tenant-1', 100);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('BUDGET_EXCEEDED');
    });

    it('should allow reservation when cost limit is 0 (unlimited)', async () => {
      const tenant = { ...mockTenant, monthlyCostLimitUsd: 0 };
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(tenant) });
      const result = await service.reserveBudget('tenant-1', 10000);
      expect(result.isOk()).toBe(true);
    });

    it('should return NOT_FOUND if tenant not found', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.reserveBudget('missing', 10);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });

    it('should return CONFLICT on concurrent modification', async () => {
      const tenant = { ...mockTenant };
      const { service } = buildService({
        findOne: vi.fn().mockResolvedValue(tenant),
        nativeUpdate: vi.fn().mockResolvedValue(0),
      });
      const result = await service.reserveBudget('tenant-1', 10);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');
    });
  });

  describe('purgeData', () => {
    it('should purge all tenant data and return counts', async () => {
      const workflows = [{ id: 'wf-1' }, { id: 'wf-2' }];
      const sessions = [{ id: 'sess-1' }];
      const findOneFn = vi.fn().mockResolvedValue(mockTenant);
      const findFn = vi.fn()
        .mockResolvedValueOnce(workflows)
        .mockResolvedValueOnce(sessions);
      const nativeDeleteFn = vi.fn().mockResolvedValue(5);

      const { service } = buildService({
        findOne: findOneFn,
        find: findFn,
        nativeDelete: nativeDeleteFn,
      });

      const result = await service.purgeData('tenant-1');
      expect(result.isOk()).toBe(true);
      const counts = result._unsafeUnwrap().deletedCounts;
      expect(counts).toHaveProperty('workflowMirrors');
      expect(counts).toHaveProperty('tenantUsers');
      expect(counts).toHaveProperty('tenant');
      expect(counts).toHaveProperty('agentToolCalls');
      expect(counts).toHaveProperty('agentSessions');
      expect(nativeDeleteFn).toHaveBeenCalled();
    });

    it('should handle tenant with no workflows', async () => {
      const findOneFn = vi.fn().mockResolvedValue(mockTenant);
      const findFn = vi.fn().mockResolvedValue([]);
      const nativeDeleteFn = vi.fn().mockResolvedValue(0);

      const { service } = buildService({
        findOne: findOneFn,
        find: findFn,
        nativeDelete: nativeDeleteFn,
      });

      const result = await service.purgeData('tenant-1');
      expect(result.isOk()).toBe(true);
      const counts = result._unsafeUnwrap().deletedCounts;
      expect(counts).not.toHaveProperty('agentToolCalls');
      expect(counts).not.toHaveProperty('agentSessions');
    });

    it('should return NOT_FOUND if tenant does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.purgeData('missing');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('exportData', () => {
    it('should export tenant data', async () => {
      const users = [{ id: 'u-1', email: 'a@b.com', role: 'admin', provider: 'github', createdAt: new Date() }];
      const workflows = [{ id: 'wf-1', state: 'completed', repoUrl: 'https://github.com/org/repo', createdAt: new Date() }];
      const alerts = [{ id: 'al-1', alertType: 'tenant_total', actualUsd: 400, createdAt: new Date() }];

      const findOneFn = vi.fn().mockResolvedValue(mockTenant);
      const findFn = vi.fn()
        .mockResolvedValueOnce(users)
        .mockResolvedValueOnce(workflows)
        .mockResolvedValueOnce(alerts);

      const { service } = buildService({ findOne: findOneFn, find: findFn });
      const result = await service.exportData('tenant-1');
      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data).toHaveProperty('tenant');
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('workflows');
      expect(data).toHaveProperty('costAlerts');
    });

    it('should return NOT_FOUND if tenant does not exist', async () => {
      const { service } = buildService({ findOne: vi.fn().mockResolvedValue(null) });
      const result = await service.exportData('missing');
      expect(result.isErr()).toBe(true);
    });
  });
});
