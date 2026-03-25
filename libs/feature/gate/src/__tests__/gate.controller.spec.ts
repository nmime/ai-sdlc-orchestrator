import { GateController } from '../gate.controller';
import { ok, err } from 'neverthrow';

const mockGateService = {
  submitDecision: vi.fn(),
  getWorkflowStatus: vi.fn(),
  cancelWorkflow: vi.fn(),
};

describe('GateController (integration)', () => {
  let controller: GateController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GateController(mockGateService as any);
  });

  describe('POST decide', () => {
    it('returns decision on success', async () => {
      const decision = { workflowId: 'wf-1', gateId: 'wf-1', action: 'approve', reviewer: 'dev@test.com', timestamp: new Date() };
      mockGateService.submitDecision.mockResolvedValue(ok(decision));
      const result = await controller.decide('wf-1', { action: 'approve' as any, reviewer: 'dev@test.com' });
      expect(result).toEqual(decision);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'dev@test.com', undefined);
    });

    it('throws on service error', async () => {
      mockGateService.submitDecision.mockResolvedValue(err({ code: 'TEMPORAL_ERROR', message: 'workflow not found' }));
      await expect(controller.decide('wf-1', { action: 'approve' as any, reviewer: 'dev' })).rejects.toThrow('workflow not found');
    });
  });

  describe('POST approve', () => {
    it('extracts reviewer from req.user', async () => {
      const decision = { workflowId: 'wf-1', action: 'approve', reviewer: 'user@test.com', timestamp: new Date() };
      mockGateService.submitDecision.mockResolvedValue(ok(decision));
      const mockReq = { user: { id: 'u-1', email: 'user@test.com', role: 'admin' } } as any;
      const result = await controller.approve('wf-1', { comment: 'LGTM' }, mockReq);
      expect(result).toEqual(decision);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'user@test.com', 'LGTM');
    });

    it('falls back to user.id when no email', async () => {
      mockGateService.submitDecision.mockResolvedValue(ok({}));
      const mockReq = { user: { id: 'u-1', email: '', role: 'admin' } } as any;
      await controller.approve('wf-1', {}, mockReq);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'u-1', undefined);
    });
  });

  describe('POST request-changes', () => {
    it('submits request_changes action', async () => {
      mockGateService.submitDecision.mockResolvedValue(ok({ action: 'request_changes' }));
      const mockReq = { user: { id: 'u-1', email: 'rev@test.com', role: 'operator' } } as any;
      await controller.requestChanges('wf-1', { comment: 'needs fixes' }, mockReq);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'request_changes', 'rev@test.com', 'needs fixes');
    });
  });

  describe('GET status', () => {
    it('returns workflow status', async () => {
      mockGateService.getWorkflowStatus.mockResolvedValue(ok({ status: 'RUNNING', runId: 'run-1' }));
      const result = await controller.getStatus('wf-1');
      expect(result).toEqual({ status: 'RUNNING', runId: 'run-1' });
    });

    it('throws on error', async () => {
      mockGateService.getWorkflowStatus.mockResolvedValue(err({ code: 'TEMPORAL_ERROR', message: 'not found' }));
      await expect(controller.getStatus('wf-1')).rejects.toThrow('not found');
    });
  });

  describe('POST cancel', () => {
    it('returns cancelled flag', async () => {
      mockGateService.cancelWorkflow.mockResolvedValue(ok(undefined));
      const result = await controller.cancel('wf-1', { reason: 'no longer needed' });
      expect(result).toEqual({ cancelled: true });
    });
  });
});
