import { TenantController } from '../tenant.controller';
import { ok, err } from 'neverthrow';

const mockTenantService = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('TenantController (integration)', () => {
  let controller: TenantController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TenantController(mockTenantService as any);
  });

  it('creates tenant', async () => {
    const tenant = { id: 't-1', slug: 'test', name: 'Test' };
    mockTenantService.create.mockResolvedValue(ok(tenant));
    const result = await controller.create({ slug: 'test', name: 'Test' } as any);
    expect(result).toEqual(tenant);
  });

  it('lists tenants', async () => {
    mockTenantService.list.mockResolvedValue(ok([{ id: 't-1' }]));
    const result = await controller.list();
    expect(result).toHaveLength(1);
  });

  it('finds by id', async () => {
    mockTenantService.findById.mockResolvedValue(ok({ id: 't-1', slug: 'test' }));
    const result = await controller.findById('t-1');
    expect(result.slug).toBe('test');
  });

  it('throws on not found', async () => {
    mockTenantService.findById.mockResolvedValue(err({ code: 'NOT_FOUND', message: 'not found' }));
    await expect(controller.findById('missing')).rejects.toThrow('not found');
  });

  it('updates tenant', async () => {
    mockTenantService.update.mockResolvedValue(ok({ id: 't-1', name: 'Updated' }));
    const result = await controller.update('t-1', { name: 'Updated' } as any);
    expect(result.name).toBe('Updated');
  });

  it('deletes tenant', async () => {
    mockTenantService.delete.mockResolvedValue(ok(undefined));
    await expect(controller.delete('t-1')).resolves.toBeUndefined();
  });

  it('throws on create error', async () => {
    mockTenantService.create.mockResolvedValue(err({ code: 'CONFLICT', message: 'slug exists' }));
    await expect(controller.create({ slug: 'dup', name: 'Dup' } as any)).rejects.toThrow('slug exists');
  });
});
