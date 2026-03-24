import { TenantService } from '../tenant.service';
import { ApiKeyService } from '../api-key.service';

const mockEm = {
  findOne: vi.fn(),
  find: vi.fn(),
  persistAndFlush: vi.fn(),
  flush: vi.fn(),
  getReference: vi.fn(),
  nativeUpdate: vi.fn(),
  nativeDelete: vi.fn(),
};

const mockLogger = {
  setContext: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantService(mockEm as any, mockLogger as any);
  });

  it('should create a tenant', async () => {
    mockEm.findOne.mockResolvedValue(null);
    mockEm.persistAndFlush.mockResolvedValue(undefined);

    const result = await service.create({ slug: 'test-org', name: 'Test Org' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.slug).toBe('test-org');
      expect(result.value.name).toBe('Test Org');
    }
    expect(mockEm.persistAndFlush).toHaveBeenCalled();
  });

  it('should reject duplicate slug', async () => {
    mockEm.findOne.mockResolvedValue({ id: 'existing', slug: 'test-org' });

    const result = await service.create({ slug: 'test-org', name: 'Test Org' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });

  it('should find tenant by id', async () => {
    const tenant = { id: 'uuid-1', slug: 'test', name: 'Test' };
    mockEm.findOne.mockResolvedValue(tenant);

    const result = await service.findById('uuid-1');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe(tenant);
  });

  it('should return NOT_FOUND for missing tenant', async () => {
    mockEm.findOne.mockResolvedValue(null);

    const result = await service.findById('nonexistent');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('should list tenants excluding deleted', async () => {
    const tenants = [{ id: '1' }, { id: '2' }];
    mockEm.find.mockResolvedValue(tenants);

    const result = await service.list();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toHaveLength(2);
  });

  it('should reserve budget with optimistic concurrency', async () => {
    const tenant = {
      id: 'uuid-1',
      monthlyCostLimitUsd: 100,
      monthlyCostReservedUsd: 10,
      monthlyCostActualUsd: 10,
      budgetVersion: 5,
    };
    mockEm.findOne.mockResolvedValue(tenant);
    mockEm.nativeUpdate.mockResolvedValue(1);

    const result = await service.reserveBudget('uuid-1', 30);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.budgetVersion).toBe(6);
  });

  it('should reject budget exceeding limit', async () => {
    const tenant = {
      id: 'uuid-1',
      monthlyCostLimitUsd: 100,
      monthlyCostReservedUsd: 40,
      monthlyCostActualUsd: 40,
      budgetVersion: 5,
    };
    mockEm.findOne.mockResolvedValue(tenant);

    const result = await service.reserveBudget('uuid-1', 30);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('BUDGET_EXCEEDED');
  });

  it('should handle budget concurrency conflict', async () => {
    const tenant = {
      id: 'uuid-1',
      monthlyCostLimitUsd: 100,
      monthlyCostReservedUsd: 10,
      monthlyCostActualUsd: 10,
      budgetVersion: 5,
    };
    mockEm.findOne.mockResolvedValue(tenant);
    mockEm.nativeUpdate.mockResolvedValue(0);

    const result = await service.reserveBudget('uuid-1', 30);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('CONFLICT');
  });
});

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiKeyService(mockEm as any, mockLogger as any);
  });

  it('should generate an API key', async () => {
    mockEm.getReference.mockReturnValue({ id: 'tenant-1' });
    mockEm.persistAndFlush.mockResolvedValue(undefined);

    const result = await service.generate('tenant-1', 'CI Token');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.key).toMatch(/^asdlc_/);
      expect(result.value.id).toBeDefined();
    }
  });

  it('should reject invalid API key', async () => {
    mockEm.findOne.mockResolvedValue(null);

    const result = await service.validate('invalid-key');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should revoke an API key', async () => {
    mockEm.nativeDelete.mockResolvedValue(1);

    const result = await service.revoke('key-1');
    expect(result.isOk()).toBe(true);
  });
});
