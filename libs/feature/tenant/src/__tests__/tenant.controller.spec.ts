import type { TenantService, CreateTenantDto, UpdateTenantDto } from '../tenant.service';
import { TenantController } from '../tenant.controller';
import { ok, err } from 'neverthrow';

const mockTenantService: Record<string, ReturnType<typeof vi.fn>> = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockReq = { user: { tenantId: 't-1', id: 'u-1', email: 'test@test.com', role: 'admin' } } as any;

describe('TenantController (integration)', () => {
  let controller: TenantController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TenantController(mockTenantService as unknown as TenantService);
  });

  it('creates tenant', async () => {
    const tenant = { id: 't-1', slug: 'test', name: 'Test' };
    mockTenantService.create.mockResolvedValue(ok(tenant));
    const dto: CreateTenantDto = { slug: 'test', name: 'Test' };
    const result = await controller.create(dto);
    expect(result).toEqual(tenant);
  });

  it('lists tenants', async () => {
    mockTenantService.findById.mockResolvedValue(ok({ id: 't-1' }));
    const result = await controller.list(mockReq);
    expect(result).toHaveLength(1);
  });

  it('finds by id', async () => {
    mockTenantService.findById.mockResolvedValue(ok({ id: 't-1', slug: 'test' }));
    const result = await controller.findById(mockReq, 't-1');
    expect(result.slug).toBe('test');
  });

  it('throws on not found', async () => {
    mockTenantService.findById.mockResolvedValue(err({ code: 'NOT_FOUND', message: 'not found' }));
    await expect(controller.findById(mockReq, 't-1')).rejects.toThrow('not found');
  });

  it('throws on tenant mismatch for findById', async () => {
    await expect(controller.findById(mockReq, 't-2')).rejects.toThrow('Access denied');
  });

  it('updates tenant', async () => {
    mockTenantService.update.mockResolvedValue(ok({ id: 't-1', name: 'Updated' }));
    const dto: UpdateTenantDto = { name: 'Updated' };
    const result = await controller.update(mockReq, 't-1', dto);
    expect(result.name).toBe('Updated');
  });

  it('deletes tenant', async () => {
    mockTenantService.delete.mockResolvedValue(ok(undefined));
    await expect(controller.delete(mockReq, 't-1')).resolves.toBeUndefined();
  });

  it('throws on create error', async () => {
    mockTenantService.create.mockResolvedValue(err({ code: 'CONFLICT', message: 'slug exists' }));
    const dto: CreateTenantDto = { slug: 'dup', name: 'Dup' };
    await expect(controller.create(dto)).rejects.toThrow('slug exists');
  });
});
