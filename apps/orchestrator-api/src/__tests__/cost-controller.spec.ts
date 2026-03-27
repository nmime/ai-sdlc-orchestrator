import { ForbiddenException } from '@nestjs/common';
import { CostController } from '../cost.controller';

const mockTenant = {
  id: 'tenant-1',
  monthlyCostLimitUsd: 1000,
  monthlyCostActualUsd: 200,
  monthlyCostReservedUsd: 50,
  monthlyAiCostActualUsd: 150,
  monthlySandboxCostActualUsd: 50,
};

const mockReq = { user: { id: 'u1', role: 'admin', tenantId: 'tenant-1' } } as any;

function buildController(overrides: Record<string, any> = {}) {
  const em = {
    findOneOrFail: vi.fn().mockResolvedValue(mockTenant),
    find: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
  return { controller: new CostController(em), em };
}

describe('CostController', () => {
  describe('getCostSummary', () => {
    it('should return cost summary for own tenant', async () => {
      const { controller } = buildController();
      const result = await controller.getCostSummary(mockReq, 'tenant-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.monthlyCostLimitUsd).toBe(1000);
      expect(result.remainingUsd).toBe(750);
    });

    it('should throw ForbiddenException for different tenant', async () => {
      const { controller } = buildController();
      await expect(controller.getCostSummary(mockReq, 'other-tenant')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRecentSessions', () => {
    it('should return sessions with clamped limit', async () => {
      const { controller, em } = buildController();
      await controller.getRecentSessions(mockReq, 'tenant-1', 200);
      expect(em.find).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('should throw ForbiddenException for different tenant', async () => {
      const { controller } = buildController();
      await expect(controller.getRecentSessions(mockReq, 'other-tenant', 20)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAlerts', () => {
    it('should return alerts for own tenant', async () => {
      const mockAlerts = [{ id: 'a1', alertType: 'budget_warning' }];
      const { controller } = buildController({ find: vi.fn().mockResolvedValue(mockAlerts) });
      const result = await controller.getAlerts(mockReq, 'tenant-1');
      expect(result).toEqual(mockAlerts);
    });

    it('should throw ForbiddenException for different tenant', async () => {
      const { controller } = buildController();
      await expect(controller.getAlerts(mockReq, 'other-tenant')).rejects.toThrow(ForbiddenException);
    });
  });
});
