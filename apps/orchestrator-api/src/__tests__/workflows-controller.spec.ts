import { BadRequestException } from '@nestjs/common';
import { WorkflowsController } from '../workflows.controller';

const mockUser = { id: 'u1', role: 'admin', tenantId: 'tenant-1', email: 'a@b.com' };
const mockReq = { user: mockUser } as any;

const mockMirror = {
  id: 'wf-1',
  tenant: 'tenant-1',
  temporalWorkflowId: 'temporal-wf-1',
  state: 'blocked_ci',
  currentStepId: 'step-1',
  createdAt: new Date(),
};

function buildController(overrides: Record<string, any> = {}) {
  const em = {
    findAndCount: vi.fn().mockResolvedValue([[mockMirror], 1]),
    findOneOrFail: vi.fn().mockResolvedValue(mockMirror),
    find: vi.fn().mockResolvedValue([]),
    flush: vi.fn(),
    ...overrides,
  } as any;

  const handle = { signal: vi.fn() };
  const workflowClient = { getHandle: vi.fn().mockReturnValue(handle) };
  const temporalClient = {
    getClient: vi.fn().mockResolvedValue({ workflow: workflowClient }),
  } as any;

  return { controller: new WorkflowsController(em, temporalClient), em, temporalClient, handle };
}

describe('WorkflowsController', () => {
  describe('list', () => {
    it('should return paginated workflows filtered by tenant', async () => {
      const { controller, em } = buildController();
      const result = await controller.list(mockReq, undefined, 50, 0);
      expect(result).toEqual({ items: [mockMirror], total: 1, limit: 50, offset: 0 });
      expect(em.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { tenant: 'tenant-1' },
        expect.objectContaining({ limit: 50, offset: 0 }),
      );
    });

    it('should filter by valid state', async () => {
      const { controller, em } = buildController();
      await controller.list(mockReq, 'implementing', 10, 0);
      expect(em.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { tenant: 'tenant-1', state: 'implementing' },
        expect.anything(),
      );
    });

    it('should throw on invalid state', async () => {
      const { controller } = buildController();
      await expect(controller.list(mockReq, 'invalid_state', 10, 0)).rejects.toThrow(BadRequestException);
    });

    it('should clamp limit to 100', async () => {
      const { controller } = buildController();
      const result = await controller.list(mockReq, undefined, 500, 0);
      expect(result.limit).toBe(100);
    });
  });

  describe('findById', () => {
    it('should return workflow scoped to tenant', async () => {
      const { controller, em } = buildController();
      const result = await controller.findById(mockReq, 'wf-1');
      expect(result).toBe(mockMirror);
      expect(em.findOneOrFail).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'wf-1', tenant: 'tenant-1' },
        expect.anything(),
      );
    });
  });

  describe('getEvents', () => {
    it('should return events for workflow', async () => {
      const { controller, em } = buildController();
      await controller.getEvents(mockReq, 'wf-1');
      expect(em.findOneOrFail).toHaveBeenCalled();
      expect(em.find).toHaveBeenCalled();
    });
  });

  describe('getSessions', () => {
    it('should return sessions for workflow', async () => {
      const { controller, em } = buildController();
      await controller.getSessions(mockReq, 'wf-1');
      expect(em.findOneOrFail).toHaveBeenCalled();
      expect(em.find).toHaveBeenCalled();
    });
  });

  describe('getArtifacts', () => {
    it('should return artifacts for workflow', async () => {
      const { controller, em } = buildController();
      await controller.getArtifacts(mockReq, 'wf-1');
      expect(em.findOneOrFail).toHaveBeenCalled();
      expect(em.find).toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('should signal workflow and update state', async () => {
      const { controller, handle, em } = buildController();
      const result = await controller.retry(mockReq, 'wf-1', { fromStep: 'step-2' });
      expect(handle.signal).toHaveBeenCalledWith('workflowUnblock', expect.objectContaining({ reason: expect.stringContaining('step-2') }));
      expect(mockMirror.state).toBe('implementing');
      expect(em.flush).toHaveBeenCalled();
      expect(result.status).toBe('retry_queued');
    });

    it('should throw if workflow is not in blocked state', async () => {
      const nonBlockedMirror = { ...mockMirror, state: 'completed' };
      const { controller } = buildController({
        findOneOrFail: vi.fn().mockResolvedValue(nonBlockedMirror),
      });
      await expect(controller.retry(mockReq, 'wf-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
