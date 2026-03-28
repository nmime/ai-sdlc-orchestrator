import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CostController } from '../cost.controller';

const mockConn = {
  execute: vi.fn(),
};

const mockEm = {
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  getConnection: vi.fn().mockReturnValue(mockConn),
};

describe('CostController (integration)', () => {
  let controller: CostController;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.getConnection.mockReturnValue(mockConn);
    controller = new CostController(mockEm as any);
  });

  describe('GET /costs/tenants/:tenantId', () => {
    it('returns cost breakdown', async () => {
      mockEm.findOne.mockResolvedValue({
        monthlyCostLimitUsd: 100, monthlyCostReservedUsd: 10, monthlyCostActualUsd: 50,
      });
      mockConn.execute.mockResolvedValue([{ count: '2', total_ai: '8', total_sandbox: '3' }]);
      const result = await controller.getTenantCosts('t-1', 't-1');
      expect(result.tenantId).toBe('t-1');
      expect(result.aiCostUsd).toBe(8);
      expect(result.sandboxCostUsd).toBe(3);
      expect(result.totalCostUsd).toBe(11);
      expect(result.workflowCount).toBe(2);
    });

    it('rejects tenant mismatch', async () => {
      await expect(controller.getTenantCosts('t-1', 't-2')).rejects.toThrow(ForbiddenException);
    });

    it('returns 404 for unknown tenant', async () => {
      mockEm.findOne.mockResolvedValue(null);
      await expect(controller.getTenantCosts('t-1', 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /costs/tenants/:tenantId/alerts', () => {
    it('returns alerts', async () => {
      const alerts = [{ id: 'a-1', alertType: 'TENANT_TOTAL' }];
      mockEm.find.mockResolvedValue(alerts);
      const result = await controller.getTenantAlerts('t-1', undefined, 't-1');
      expect(result).toEqual(alerts);
    });

    it('respects limit parameter', async () => {
      mockEm.find.mockResolvedValue([]);
      await controller.getTenantAlerts('t-1', '10', 't-1');
      expect(mockEm.find).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ limit: 10 }),
      );
    });

    it('rejects tenant mismatch', async () => {
      await expect(controller.getTenantAlerts('t-1', undefined, 't-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /costs/workflows/:workflowId', () => {
    it('returns workflow cost with sessions', async () => {
      mockEm.findOne.mockResolvedValue({
        id: 'wf-1', temporalWorkflowId: 'wf-1', costUsdTotal: 5, aiCostUsd: 3, sandboxCostUsd: 2,
      });
      mockEm.find.mockResolvedValue([
        {
          id: 's-1', provider: 'claude-code', model: 'sonnet', mode: 'implement',
          aiCostUsd: 3, sandboxCostUsd: 2, totalCostUsd: 5, inputTokens: 1000, outputTokens: 500,
          startedAt: new Date('2025-01-01'), completedAt: new Date('2025-01-01T00:05:00'),
        },
      ]);
      const result = await controller.getWorkflowCost('t-1', 'wf-1');
      expect(result.totalCostUsd).toBe(5);
      expect((result.sessions as unknown as Array<{ duration: number }>)[0].duration).toBe(300);
    });

    it('returns 404 for unknown workflow', async () => {
      mockEm.findOne.mockResolvedValue(null);
      await expect(controller.getWorkflowCost('t-1', 'wf-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /costs/tenants/:tenantId/by-repo', () => {
    it('groups costs by repo', async () => {
      mockConn.execute.mockResolvedValue([
        { repo_id: 'repo-1', ai: '5', sandbox: '2', count: '2' },
        { repo_id: 'repo-2', ai: '5', sandbox: '3', count: '1' },
      ]);
      const result = await controller.getCostsByRepo('t-1', 't-1');
      expect(result).toHaveLength(2);
      const repo1 = result.find(r => r.repoId === 'repo-1')!;
      expect(repo1.totalCostUsd).toBe(7);
      expect(repo1.workflowCount).toBe(2);
    });

    it('rejects tenant mismatch', async () => {
      await expect(controller.getCostsByRepo('t-1', 't-2')).rejects.toThrow(ForbiddenException);
    });
  });
});
