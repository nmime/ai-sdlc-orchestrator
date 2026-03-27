import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService, TemporalClientService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { WebhookDelivery, DeliveryStatus, Tenant } from '@ai-sdlc/db';
import type { WebhookEvent } from '@ai-sdlc/shared-type';
import { JiraHandler } from './handlers/jira.handler';
import { GitLabHandler } from './handlers/gitlab.handler';
import { GitHubHandler } from './handlers/github.handler';
import { LinearHandler } from './handlers/linear.handler';
import { v4 } from 'uuid';

interface WebhookHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError>;
  verifySignature?(headers: Record<string, string>, rawBody: string, tenantId: string): void;
}

@Injectable()
export class WebhookService {
  private handlers: Map<string, WebhookHandler>;

  constructor(
    private readonly em: EntityManager,
    private readonly temporalClient: TemporalClientService,
    private readonly logger: PinoLoggerService,
    private readonly jiraHandler: JiraHandler,
    private readonly gitLabHandler: GitLabHandler,
    private readonly gitHubHandler: GitHubHandler,
    private readonly linearHandler: LinearHandler,
  ) {
    this.logger.setContext('WebhookService');
    this.handlers = new Map<string, WebhookHandler>([
      ['jira', this.jiraHandler],
      ['gitlab', this.gitLabHandler],
      ['github', this.gitHubHandler],
      ['linear', this.linearHandler],
    ]);
  }

  async processWebhook(
    platform: string,
    tenantId: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): Promise<Result<{ accepted: boolean; deliveryId: string }, AppError>> {
    const handler = this.handlers.get(platform);
    if (!handler) {
      return ResultUtils.err('VALIDATION_ERROR', `Unknown platform: ${platform}`);
    }

    const rawBody = JSON.stringify(body);
    if (handler.verifySignature) {
      handler.verifySignature(headers, rawBody, tenantId);
    }

    const tenant = await this.em.findOne(Tenant, { id: tenantId });
    if (!tenant) {
      return ResultUtils.err('VALIDATION_ERROR', `Unknown tenant: ${tenantId}`);
    }

    const parseResult = handler.parse(headers, body, tenantId);
    if (parseResult.isErr()) return parseResult as unknown as Result<never, AppError>;

    const event = parseResult.value;
    if (!event) {
      return ResultUtils.ok({ accepted: true, deliveryId: 'ignored' });
    }

    const delivery = new WebhookDelivery();
    delivery.tenant = this.em.getReference(Tenant, tenantId);
    delivery.platform = platform;
    delivery.eventType = event.eventType;
    delivery.deliveryId = event.deliveryId;
    delivery.status = DeliveryStatus.RECEIVED;

    try {
      await this.em.persistAndFlush(delivery);
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      if (dbError.code === '23505') {
        this.logger.warn(`Duplicate webhook ignored: ${event.deliveryId}`);
        return ResultUtils.ok({ accepted: true, deliveryId: 'duplicate' });
      }
      return ResultUtils.err('INTERNAL_ERROR', 'Failed to persist webhook delivery');
    }

    try {
      const client = await this.temporalClient.getClient();
      const workflowId = `orchestrate-${tenantId}-${event.taskId}-${v4().slice(0, 8)}`;

      await client.workflow.start('orchestrateTaskWorkflow', {
        taskQueue: 'orchestrator-queue',
        workflowId,
        args: [{
          tenantId,
          taskId: event.taskId,
          taskProvider: event.taskProvider,
          repoId: event.repoUrl.split('/').slice(-1)[0]?.replace('.git', '') || '',
          repoUrl: event.repoUrl,
          webhookDeliveryId: delivery.id,
          labels: event.labels,
        }],
      });

      delivery.status = DeliveryStatus.PROCESSING;
      delivery.workflowId = workflowId;
      await this.em.flush();

      this.logger.log(`Workflow started: ${workflowId}`);
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = (error as Error).message;
      await this.em.flush();
      return ResultUtils.err('TEMPORAL_ERROR', (error as Error).message);
    }

    return ResultUtils.ok({ accepted: true, deliveryId: delivery.id });
  }
}
