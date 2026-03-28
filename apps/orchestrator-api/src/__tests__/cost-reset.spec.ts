import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostResetService } from '../cost-reset.service';

function createMockEm() {
  const em = {
    nativeUpdate: vi.fn().mockResolvedValue(5),
    fork: vi.fn(),
  } as any;
  em.fork.mockReturnValue(em);
  return em;
}

function createMockLogger() {
  return { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

describe('CostResetService', () => {
  let service: CostResetService;
  let em: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    em = createMockEm();
    service = new CostResetService(em, createMockLogger());
  });

  it('resets monthly costs for all tenants', async () => {
    await service.resetMonthlyCosts();
    expect(em.fork).toHaveBeenCalled();
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      {},
      expect.objectContaining({
        monthlyCostActualUsd: 0,
        monthlyCostReservedUsd: 0,
        monthlyAiCostActualUsd: 0,
        monthlySandboxCostActualUsd: 0,
      }),
    );
  });
});
