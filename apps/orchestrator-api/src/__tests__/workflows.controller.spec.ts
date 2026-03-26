import { WorkflowsController } from '../workflows.controller';

const mockEm = {
  find: vi.fn(),
  findOneOrFail: vi.fn(),
  findAndCount: vi.fn(),
};

const mockReq = { user: { tenantId: 't-1', id: 'u-1', email: 'test@test.com', role: 'admin' } } as any;

describe('WorkflowsController (integration)', () => {
  let controller: WorkflowsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WorkflowsController(mockEm);
  });

  describe('GET /', () => {
    it('returns paginated list', async () => {
      mockEm.findAndCount.mockResolvedValue([[{ id: 'wf-1' }], 1]);
      const result = await controller.list(mockReq);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('applies filters', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);
      await controller.list(mockReq, 'implementing', 'repo-1', '10', '5');
      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { tenant: 't-1', state: 'implementing', repoId: 'repo-1' },
        expect.objectContaining({ limit: 10, offset: 5 }),
      );
    });
  });

  describe('GET /:id', () => {
    it('returns workflow detail with events, sessions, artifacts', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'wf-1', temporalWorkflowId: 'wf-1' });
      mockEm.find
        .mockResolvedValueOnce([{ id: 'ev-1' }])
        .mockResolvedValueOnce([{ id: 'sess-1' }])
        .mockResolvedValueOnce([{ id: 'art-1' }]);
      const result = await controller.detail(mockReq, 'wf-1');
      expect(result.workflow.id).toBe('wf-1');
      expect(result.events).toHaveLength(1);
      expect(result.sessions).toHaveLength(1);
      expect(result.artifacts).toHaveLength(1);
    });
  });

  describe('GET /:id/events', () => {
    it('returns events timeline', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'wf-1' });
      mockEm.find.mockResolvedValue([{ id: 'ev-1', eventType: 'state_transition' }]);
      const result = await controller.events(mockReq, 'wf-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('GET /:id/sessions', () => {
    it('returns sessions with tool calls', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'wf-1' });
      mockEm.find
        .mockResolvedValueOnce([{ id: 'sess-1', provider: 'claude-code' }])
        .mockResolvedValueOnce([{ id: 'tc-1', toolName: 'bash' }]);
      const result = await controller.sessions(mockReq, 'wf-1');
      expect(result).toHaveLength(1);
      expect((result[0] as unknown as { toolCalls: unknown[] }).toolCalls).toHaveLength(1);
    });
  });

  describe('GET /:id/artifacts', () => {
    it('returns artifacts', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'wf-1' });
      mockEm.find.mockResolvedValue([{ id: 'art-1', kind: 'patch' }]);
      const result = await controller.artifacts(mockReq, 'wf-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('GET /:id/cost', () => {
    it('returns cost breakdown', async () => {
      mockEm.findOneOrFail.mockResolvedValue({ id: 'wf-1', costUsdTotal: 10, aiCostUsd: 7, sandboxCostUsd: 3 });
      mockEm.find.mockResolvedValue([{ id: 's-1', provider: 'claude', model: 'sonnet', mode: 'implement', aiCostUsd: 7, sandboxCostUsd: 3 }]);
      const result = await controller.cost(mockReq, 'wf-1');
      expect(result.totalCostUsd).toBe(10);
      expect((result.bySession as unknown as unknown[])).toHaveLength(1);
    });
  });
});
