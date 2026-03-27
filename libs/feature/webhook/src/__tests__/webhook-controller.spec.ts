import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { WebhookController } from '../webhook.controller';

function buildController(overrides: Record<string, any> = {}) {
  const webhookService = {
    processWebhook: vi.fn().mockResolvedValue({
      isErr: () => false,
      value: { accepted: true, deliveryId: 'del-1' },
    }),
    ...overrides,
  } as any;
  return { controller: new WebhookController(webhookService), webhookService };
}

describe('WebhookController', () => {
  describe('handleWebhook', () => {
    it('should accept valid webhook', async () => {
      const { controller } = buildController();
      const result = await controller.handleWebhook('github', 'tenant-1', {}, { action: 'opened' });
      expect(result).toEqual({ accepted: true, deliveryId: 'del-1' });
    });

    it('should reject invalid platform identifier', async () => {
      const { controller } = buildController();
      await expect(
        controller.handleWebhook('INVALID!', 'tenant-1', {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject platform starting with number', async () => {
      const { controller } = buildController();
      await expect(
        controller.handleWebhook('1github', 'tenant-1', {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid tenantId', async () => {
      const { controller } = buildController();
      await expect(
        controller.handleWebhook('github', 'invalid tenant!@#', {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for VALIDATION_ERROR', async () => {
      const { controller } = buildController({
        processWebhook: vi.fn().mockResolvedValue({
          isErr: () => true,
          error: { code: 'VALIDATION_ERROR', message: 'Unknown platform' },
        }),
      });
      await expect(
        controller.handleWebhook('unknown', 'tenant-1', {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      const { controller } = buildController({
        processWebhook: vi.fn().mockResolvedValue({
          isErr: () => true,
          error: { code: 'TEMPORAL_ERROR', message: 'Temporal down' },
        }),
      });
      await expect(
        controller.handleWebhook('github', 'tenant-1', {}, {}),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should accept valid platform identifiers', async () => {
      const { controller } = buildController();
      const result = await controller.handleWebhook('my-platform_1', 'valid-tenant', {}, {});
      expect(result.accepted).toBe(true);
    });
  });
});
