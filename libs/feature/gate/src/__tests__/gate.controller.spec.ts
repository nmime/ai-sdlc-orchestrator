import type { GateAction } from '@app/shared-type';
import type { GateService } from '../gate.service';
import { GateController } from '../gate.controller';
import { ok, err } from 'neverthrow';

const mockGateService: Record<string, ReturnType<typeof vi.fn>> = {
  submitDecision: vi.fn(),
  getWorkflowStatus: vi.fn(),
  cancelWorkflow: vi.fn(),
};

const mockEm = {
  findOneOrFail: vi.fn().mockResolvedValue({}),
};

const mockUser = { id: 'u-1', email: 'user@test.com', role: 'admin', tenantId: 'tenant-1' };

let controller: GateController;

describe('GateController (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GateController(mockGateService as unknown as GateService, mockEm as any);
  });

  describe('POST decide', () => {
    it('returns decision on success', async () => {
      const decision = { workflowId: 'wf-1', gateId: 'wf-1', action: 'approve', reviewer: 'dev@test.com', timestamp: new Date() };
      mockGateService.submitDecision.mockResolvedValue(ok(decision));
      const action: GateAction = 'approve';
      const result = await controller.decide('wf-1', { action, reviewer: 'dev@test.com' }, 'tenant-1');
      expect(result).toEqual(decision);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'dev@test.com', undefined);
    });

    it('throws on service error', async () => {
      mockGateService.submitDecision.mockResolvedValue(err({ code: 'TEMPORAL_ERROR', message: 'workflow not found' }));
      const action: GateAction = 'approve';
      await expect(controller.decide('wf-1', { action, reviewer: 'dev' }, 'tenant-1')).rejects.toThrow('workflow not found');
    });
  });

  describe('POST approve', () => {
    it('extracts reviewer from req.user', async () => {
      const decision = { workflowId: 'wf-1', action: 'approve', reviewer: 'user@test.com', timestamp: new Date() };
      mockGateService.submitDecision.mockResolvedValue(ok(decision));
      const result = await controller.approve('wf-1', { comment: 'LGTM' }, mockUser as any, 'tenant-1');
      expect(result).toEqual(decision);
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'user@test.com', 'LGTM');
    });

    it('falls back to user.id when no email', async () => {
      mockGateService.submitDecision.mockResolvedValue(ok({}));
      await controller.approve('wf-1', {}, { ...mockUser, email: '' } as any, 'tenant-1');
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'approve', 'u-1', undefined);
    });
  });

  describe('POST request-changes', () => {
    it('submits request_changes action', async () => {
      mockGateService.submitDecision.mockResolvedValue(ok({ action: 'request_changes' }));
      await controller.requestChanges('wf-1', { comment: 'needs fixes' }, { ...mockUser, email: 'rev@test.com', role: 'operator' } as any, 'tenant-1');
      expect(mockGateService.submitDecision).toHaveBeenCalledWith('wf-1', 'request_changes', 'rev@test.com', 'needs fixes');
    });
  });

  describe('GET status', () => {
    it('returns workflow status', async () => {
      mockGateService.getWorkflowStatus.mockResolvedValue(ok({ status: 'RUNNING', runId: 'run-1' }));
      const result = await controller.getStatus('wf-1', 'tenant-1');
      expect(result).toEqual({ status: 'RUNNING', runId: 'run-1' });
    });

    it('throws on error', async () => {
      mockGateService.getWorkflowStatus.mockResolvedValue(err({ code: 'TEMPORAL_ERROR', message: 'not found' }));
      await expect(controller.getStatus('wf-1', 'tenant-1')).rejects.toThrow('not found');
    });
  });

  describe('POST cancel', () => {
    it('returns cancelled flag', async () => {
      mockGateService.cancelWorkflow.mockResolvedValue(ok(undefined));
      const result = await controller.cancel('wf-1', { reason: 'no longer needed' }, 'tenant-1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  describe('tenant isolation', () => {
    it('rejects when workflow belongs to different tenant', async () => {
      mockEm.findOneOrFail.mockRejectedValueOnce(new Error('not found'));
      await expect(controller.getStatus('wf-1', 'tenant-1')).rejects.toThrow('not found');
    });
  });
});
