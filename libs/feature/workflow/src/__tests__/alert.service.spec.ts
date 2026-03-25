import { createMockEm, createMockLogger } from '@ai-sdlc/common/__tests__/test-utils';
import { AlertService } from '../alert.service';
import { WorkflowStatus } from '@ai-sdlc/db';

describe('AlertService', () => {
  let service: AlertService;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    service = new AlertService(mockEm, mockLogger as any);
  });

  describe('checkStuckWorkflows', () => {
    it('returns empty when no stuck workflows', async () => {
      mockEm.find.mockResolvedValue([]);
      const alerts = await service.checkStuckWorkflows('t-1');
      expect(alerts).toEqual([]);
    });

    it('creates alert for stuck workflow', async () => {
      mockEm.find.mockResolvedValue([
        { id: 'wf-1', state: WorkflowStatus.IMPLEMENTING, costUsdTotal: 5, updatedAt: new Date(Date.now() - 200 * 60000) },
      ]);
      mockEm.findOne.mockResolvedValue(null);
      const alerts = await service.checkStuckWorkflows('t-1');
      expect(alerts).toHaveLength(1);
      expect(mockEm.persist).toHaveBeenCalled();
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('skips if alert already exists', async () => {
      mockEm.find.mockResolvedValue([
        { id: 'wf-1', state: WorkflowStatus.CI_WATCH, costUsdTotal: 3, updatedAt: new Date(Date.now() - 200 * 60000) },
      ]);
      mockEm.findOne.mockResolvedValue({ id: 'existing-alert' });
      const alerts = await service.checkStuckWorkflows('t-1');
      expect(alerts).toEqual([]);
    });

    it('respects custom staleMinutes', async () => {
      mockEm.find.mockResolvedValue([]);
      await service.checkStuckWorkflows('t-1', 60);
      const findCall = mockEm.find.mock.calls[0];
      const whereClause = findCall[1];
      expect(whereClause.updatedAt.$lt).toBeInstanceOf(Date);
    });
  });

  describe('checkQualityDegradation', () => {
    it('returns not degraded when fewer than 10 sessions', async () => {
      mockEm.find.mockResolvedValue(Array(5).fill({ qualityScore: 0.5, startedAt: new Date() }));
      const result = await service.checkQualityDegradation('t-1');
      expect(result.degraded).toBe(false);
      expect(result.avgScore).toBe(0);
    });

    it('detects degradation when recent scores drop below 70% of average', async () => {
      const old = Array(90).fill(null).map(() => ({ qualityScore: 0.9, startedAt: new Date(Date.now() - 100000) }));
      const recent = Array(10).fill(null).map(() => ({ qualityScore: 0.3, startedAt: new Date() }));
      mockEm.find.mockResolvedValue([...recent, ...old]);
      const result = await service.checkQualityDegradation('t-1');
      expect(result.degraded).toBe(true);
      expect(result.recentScore).toBeLessThan(result.avgScore * 0.7);
    });

    it('returns not degraded when scores are consistent', async () => {
      const sessions = Array(20).fill(null).map(() => ({ qualityScore: 0.8, startedAt: new Date() }));
      mockEm.find.mockResolvedValue(sessions);
      const result = await service.checkQualityDegradation('t-1');
      expect(result.degraded).toBe(false);
    });
  });

  describe('getProviderComparison', () => {
    it('groups sessions by provider', async () => {
      mockEm.find.mockResolvedValue([
        { provider: 'claude-code', qualityScore: 0.9, totalCostUsd: 0.05, status: 'completed' },
        { provider: 'claude-code', qualityScore: 0.8, totalCostUsd: 0.06, status: 'completed' },
        { provider: 'openhands', qualityScore: 0.7, totalCostUsd: 0.03, status: 'failed' },
      ]);
      const result = await service.getProviderComparison('t-1');
      expect(result).toHaveLength(2);
      const claude = result.find(r => r.provider === 'claude-code')!;
      expect(claude.count).toBe(2);
      expect(claude.successRate).toBe(1);
      expect(claude.avgQuality).toBeCloseTo(0.85);
      const oh = result.find(r => r.provider === 'openhands')!;
      expect(oh.successRate).toBe(0);
    });

    it('returns empty array when no sessions', async () => {
      mockEm.find.mockResolvedValue([]);
      const result = await service.getProviderComparison('t-1');
      expect(result).toEqual([]);
    });
  });
});
