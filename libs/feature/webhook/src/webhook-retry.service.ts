import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PinoLoggerService, TemporalClientService } from '@ai-sdlc/common';
import { WebhookDelivery, DeliveryStatus } from '@ai-sdlc/db';

@Injectable()
export class WebhookRetryService implements OnModuleInit, OnModuleDestroy {
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
    private readonly temporalClient: TemporalClientService,
  ) {
    this.logger.setContext('WebhookRetryService');
  }

  onModuleInit() {
    this.interval = setInterval(() => this.retryFailed(), 60_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async retryFailed(): Promise<void> {
    const fork = this.em.fork();
    const failed = await fork.find(WebhookDelivery, {
      status: DeliveryStatus.FAILED,
    }, { limit: 10, orderBy: { createdAt: 'ASC' } });

    for (const delivery of failed) {
      try {
        const client = await this.temporalClient.getClient();
        await client.workflow.start('orchestrateTaskWorkflow', {
          taskQueue: 'orchestrator-queue',
          workflowId: `webhook-retry-${delivery.id}`,
          args: [{
            tenantId: delivery.tenant.id,
            taskId: delivery.deliveryId,
            taskProvider: delivery.platform,
            repoId: '',
            repoUrl: '',
            webhookDeliveryId: delivery.id,
          }],
        });
        delivery.status = DeliveryStatus.PROCESSING;
        this.logger.log(`Retrying webhook delivery ${delivery.id}`);
      } catch (error) {
        this.logger.error(`Retry failed for delivery ${delivery.id}: ${(error as Error).message}`);
      }
    }
    await fork.flush();
  }
}
