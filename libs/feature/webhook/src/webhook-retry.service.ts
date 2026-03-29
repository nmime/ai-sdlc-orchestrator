import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EntityManager } from '@mikro-orm/postgresql';
import { type PinoLoggerService, type TemporalClientService, sanitizeLog } from '@app/common';
import { WebhookDelivery, DeliveryStatus } from '@app/db';

@Injectable()
export class WebhookRetryService implements OnModuleInit, OnModuleDestroy {
  private interval?: ReturnType<typeof setInterval>;
  private readonly maxRetries: number;
  private readonly retryIntervalMs: number;
  private readonly retryBatchSize: number;

  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
    private readonly temporalClient: TemporalClientService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext('WebhookRetryService');
    this.maxRetries = parseInt(this.configService.get<string>('WEBHOOK_MAX_RETRIES') || '5', 10);
    this.retryIntervalMs = parseInt(this.configService.get<string>('WEBHOOK_RETRY_INTERVAL_MS') || '60000', 10);
    this.retryBatchSize = parseInt(this.configService.get<string>('WEBHOOK_RETRY_BATCH_SIZE') || '10', 10);
  }

  onModuleInit() {
    this.interval = setInterval(() => this.retryFailed(), this.retryIntervalMs);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async retryFailed(): Promise<void> {
    const fork = this.em.fork();
    const failed = await fork.find(WebhookDelivery, {
      status: DeliveryStatus.FAILED,
      retryCount: { $lt: this.maxRetries },
    }, { limit: this.retryBatchSize, orderBy: { createdAt: 'ASC' } });

    for (const delivery of failed) {
      try {
        const client = await this.temporalClient.getClient();
        await client.workflow.start('orchestrateTaskWorkflow', {
          taskQueue: 'orchestrator-queue',
          workflowId: `webhook-retry-${delivery.id}-${delivery.retryCount}`,
          args: [{
            tenantId: delivery.tenant.id,
            taskId: delivery.deliveryId,
            taskProvider: delivery.platform,
            repoId: delivery.repoId || '',
            repoUrl: delivery.repoUrl || '',
            webhookDeliveryId: delivery.id,
          }],
        });
        delivery.status = DeliveryStatus.PROCESSING;
        delivery.retryCount = (delivery.retryCount || 0) + 1;
        this.logger.log(`Retrying webhook delivery ${sanitizeLog(delivery.id)} (attempt ${delivery.retryCount})`);
      } catch (error) {
        this.logger.error(`Retry failed for delivery ${sanitizeLog(delivery.id)}: ${sanitizeLog((error as Error).message)}`);
      }
    }
    await fork.flush();
  }
}
