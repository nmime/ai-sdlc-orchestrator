import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PinoLoggerService, TemporalClientService } from '@app/common';
import { WebhookDelivery, DeliveryStatus } from '@app/db';

@Injectable()
export class WebhookRetryService implements OnModuleInit, OnModuleDestroy {
  private interval?: ReturnType<typeof setInterval>;
  private readonly maxRetries = parseInt(process.env['WEBHOOK_MAX_RETRIES'] || '5', 10);
  private readonly retryIntervalMs = parseInt(process.env['WEBHOOK_RETRY_INTERVAL_MS'] || '60000', 10);
  private readonly retryBatchSize = parseInt(process.env['WEBHOOK_RETRY_BATCH_SIZE'] || '10', 10);

  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
    private readonly temporalClient: TemporalClientService,
  ) {
    this.logger.setContext('WebhookRetryService');
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
        this.logger.log(`Retrying webhook delivery ${delivery.id} (attempt ${delivery.retryCount})`);
      } catch (error) {
        this.logger.error(`Retry failed for delivery ${delivery.id}: ${(error as Error).message}`);
      }
    }
    await fork.flush();
  }
}
