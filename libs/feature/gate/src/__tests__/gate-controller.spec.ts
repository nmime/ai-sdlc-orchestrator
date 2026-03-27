import { NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { GateController } from '../gate.controller';

const mockReq = { user: { id: 'u1', role: 'admin', tenantId: 'tenant-1' } } as any;

function buildController(overrides: Record<string, any> = {}) {
  const em = {
    findOne: vi.fn().mockResolvedValue({ id: 'wf-1', temporalWorkflowId: 'twf-1', tenant: 'tenant-1' }),
    ...overrides,
  } as any;

  const gateService = {
    submitDecision: vi.fn().mockResolvedValue({ isErr: () => false, value: { decision: 'approved' } }),
    getWorkflowStatus: vi.fn().mockResolvedValue({ isErr: () => false, value: { state: 'awaiting_gate' } }),
    cancelWorkflow: vi.fn().mockResolvedValue({ isErr: () => false, value: undefined }),
    ...overrides.gateService,
  } as any;

  return { controller: new GateController(gateService, em), em, gateService };
}

describe('GateController', () => {
  describe('decide', () => {
    it('should submit decision for accessible workflow', async () => {
      const { controller } = buildController();
      const result = await controller.decide(mockReq, 'twf-1', {
        action: 'approve' as any,
        reviewer: 'alice',
        comment: 'looks good',
      });
      expect(result).toEqual({ decision: 'approved' });
    });

    it('should throw NotFoundException when workflow not found', async () => {
      const { controller } = buildController({ findOne: vi.fn().mockResolvedValue(null) });
      await expect(
        controller.decide(mockReq, 'twf-missing', { action: 'approve' as any, reviewer: 'alice' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on service failure', async () => {
      const { controller } = buildController({
        gateService: {
          submitDecision: vi.fn().mockResolvedValue({ isErr: () => true }),
        },
      });
      await expect(
        controller.decide(mockReq, 'twf-1', { action: 'approve' as any, reviewer: 'alice' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getStatus', () => {
    it('should return workflow status', async () => {
      const { controller } = buildController();
      const result = await controller.getStatus(mockReq, 'twf-1');
      expect(result).toEqual({ state: 'awaiting_gate' });
    });

    it('should throw NotFoundException when service returns error', async () => {
      const { controller } = buildController({
        gateService: {
          getWorkflowStatus: vi.fn().mockResolvedValue({ isErr: () => true }),
        },
      });
      await expect(controller.getStatus(mockReq, 'twf-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel workflow', async () => {
      const { controller } = buildController();
      const result = await controller.cancel(mockReq, 'twf-1', { reason: 'no longer needed' });
      expect(result).toEqual({ cancelled: true });
    });

    it('should throw InternalServerErrorException on service failure', async () => {
      const { controller } = buildController({
        gateService: {
          cancelWorkflow: vi.fn().mockResolvedValue({ isErr: () => true }),
        },
      });
      await expect(
        controller.cancel(mockReq, 'twf-1', { reason: 'test' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
