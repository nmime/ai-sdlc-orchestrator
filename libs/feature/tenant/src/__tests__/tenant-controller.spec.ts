import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantController } from '../tenant.controller';

const mockReq = { user: { id: 'u1', role: 'admin', tenantId: 'tenant-1' } } as any;
const mockTenant = { id: 'tenant-1', slug: 'acme', name: 'Acme Corp' };

function okResult(value: any) {
  return { isErr: () => false, value };
}
function errResult(code: string, msg: string) {
  return { isErr: () => true, error: { code, message: msg } };
}

function buildController(overrides: Record<string, any> = {}) {
  const tenantService = {
    create: vi.fn().mockResolvedValue(okResult(mockTenant)),
    findById: vi.fn().mockResolvedValue(okResult(mockTenant)),
    update: vi.fn().mockResolvedValue(okResult(mockTenant)),
    delete: vi.fn().mockResolvedValue(okResult(undefined)),
    purgeData: vi.fn().mockResolvedValue(okResult({ deletedCounts: { tenant: 1 } })),
    exportData: vi.fn().mockResolvedValue(okResult({ tenant: mockTenant })),
    ...overrides,
  } as any;
  return { controller: new TenantController(tenantService), tenantService };
}

describe('TenantController', () => {
  describe('create', () => {
    it('should create tenant', async () => {
      const { controller } = buildController();
      const result = await controller.create(mockReq, { slug: 'acme', name: 'Acme Corp' });
      expect(result).toBe(mockTenant);
    });

    it('should throw BadRequestException on failure', async () => {
      const { controller } = buildController({
        create: vi.fn().mockResolvedValue(errResult('CONFLICT', 'exists')),
      });
      await expect(controller.create(mockReq, { slug: 'acme', name: 'Acme' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('should return own tenant as array', async () => {
      const { controller } = buildController();
      const result = await controller.list(mockReq);
      expect(result).toEqual([mockTenant]);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      const { controller } = buildController({
        findById: vi.fn().mockResolvedValue(errResult('NOT_FOUND', 'not found')),
      });
      await expect(controller.list(mockReq)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return tenant', async () => {
      const { controller } = buildController();
      const result = await controller.findById(mockReq, 'tenant-1');
      expect(result).toBe(mockTenant);
    });

    it('should throw ForbiddenException for other tenant', async () => {
      const { controller } = buildController();
      await expect(controller.findById(mockReq, 'other-tenant')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      const { controller } = buildController();
      const result = await controller.update(mockReq, 'tenant-1', { name: 'New Name' });
      expect(result).toBe(mockTenant);
    });

    it('should throw ForbiddenException for other tenant', async () => {
      const { controller } = buildController();
      await expect(controller.update(mockReq, 'other', { name: 'X' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete tenant', async () => {
      const { controller } = buildController();
      await expect(controller.delete(mockReq, 'tenant-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException on failure', async () => {
      const { controller } = buildController({
        delete: vi.fn().mockResolvedValue(errResult('NOT_FOUND', 'not found')),
      });
      await expect(controller.delete(mockReq, 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('purgeData', () => {
    it('should purge data for own tenant', async () => {
      const { controller } = buildController();
      const result = await controller.purgeData(mockReq, 'tenant-1');
      expect(result.deletedCounts.tenant).toBe(1);
    });

    it('should throw ForbiddenException for other tenant', async () => {
      const { controller } = buildController();
      await expect(controller.purgeData(mockReq, 'other')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportData', () => {
    it('should export data for own tenant', async () => {
      const { controller } = buildController();
      const result = await controller.exportData(mockReq, 'tenant-1');
      expect(result.tenant).toBe(mockTenant);
    });

    it('should throw ForbiddenException for other tenant', async () => {
      const { controller } = buildController();
      await expect(controller.exportData(mockReq, 'other')).rejects.toThrow(ForbiddenException);
    });
  });
});
