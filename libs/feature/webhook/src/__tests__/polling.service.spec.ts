import { createMockEm, createMockLogger, createMockTemporalClient } from '../../../../common/src/__tests__/test-utils';
import { PollingService } from '../polling/polling.service';

describe('PollingService', () => {
  let service: PollingService;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockTemporal: ReturnType<typeof createMockTemporalClient>;
  let mockFork: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockFork = createMockEm();
    mockEm.fork.mockReturnValue(mockFork);
    mockLogger = createMockLogger();
    mockTemporal = createMockTemporalClient();
    service = new PollingService(mockEm as any, mockLogger as any, mockTemporal as any);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('pollAll', () => {
    it('does nothing when no enabled schedules', async () => {
      mockFork.find.mockResolvedValue([]);
      await service.pollAll();
      expect(mockFork.flush).toHaveBeenCalled();
    });

    it('skips schedule if polled recently', async () => {
      mockFork.find.mockResolvedValue([{
        id: 's-1', tenant: { id: 't-1' }, repoConfig: {},
        platform: 'github', enabled: true, pollIntervalSeconds: 300,
        lastPollAt: new Date(), queryFilter: {},
      }]);
      await service.pollAll();
      expect(mockTemporal.getClient).not.toHaveBeenCalled();
    });

    it('skips existing workflows (dedup)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => [{ number: 42, title: 'test issue' }],
      } as any);
      mockFork.find.mockResolvedValueOnce([{
        id: 's-1', tenant: { id: 't-1' }, repoConfig: {},
        platform: 'github', enabled: true, pollIntervalSeconds: 60,
        lastPollAt: new Date(Date.now() - 120000), queryFilter: { repo: 'org/repo', token: 'tok' },
      }]);
      mockFork.findOne.mockResolvedValue({ id: 'existing-wf' });
      await service.pollAll();
      expect(mockTemporal.getClient).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('starts workflow for new tasks', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => [{ number: 99, title: 'new issue' }],
      } as any);
      mockFork.find.mockResolvedValueOnce([{
        id: 's-1', tenant: { id: 't-1' }, repoConfig: {},
        platform: 'github', enabled: true, pollIntervalSeconds: 60,
        lastPollAt: new Date(Date.now() - 120000), queryFilter: { repo: 'org/repo', token: 'tok' },
      }]);
      mockFork.findOne.mockResolvedValue(null);
      await service.pollAll();
      const client = await mockTemporal.getClient();
      expect(client.workflow.start).toHaveBeenCalledWith(
        'orchestrateTaskWorkflow',
        expect.objectContaining({ taskQueue: 'orchestrator-queue' }),
      );
      fetchSpy.mockRestore();
    });

    it('logs error when polling fails', async () => {
      mockFork.find.mockResolvedValueOnce([{
        id: 's-1', tenant: { id: 't-1' }, repoConfig: {},
        platform: 'unknown_platform', enabled: true, pollIntervalSeconds: 60,
        lastPollAt: new Date(Date.now() - 120000), queryFilter: {},
      }]);
      await service.pollAll();
      expect(mockFork.flush).toHaveBeenCalled();
    });

    it('handles Jira polling', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ issues: [{ key: 'PROJ-1', fields: { summary: 'task' } }] }),
      } as any);
      mockFork.find.mockResolvedValueOnce([{
        id: 's-1', tenant: { id: 't-1' }, repoConfig: {},
        platform: 'jira', enabled: true, pollIntervalSeconds: 60,
        lastPollAt: new Date(Date.now() - 120000),
        queryFilter: { baseUrl: 'https://jira.example.com', jql: 'project=TEST', token: 'tok', repoId: 'r-1', repoUrl: 'url' },
      }]);
      mockFork.findOne.mockResolvedValue(null);
      await service.pollAll();
      const client = await mockTemporal.getClient();
      expect(client.workflow.start).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('lifecycle', () => {
    it('sets up interval on init', () => {
      const spy = vi.spyOn(globalThis, 'setInterval');
      service.onModuleInit();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });
  });
});
