import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result, err } from 'neverthrow';
import { ResultUtils, PinoLoggerService, TemporalClientService } from '@app/common';
import type { AppError } from '@app/common';
import { WebhookDelivery, DeliveryStatus, Tenant, WorkflowMirror, WorkflowStatus, TenantWebhookConfig, WebhookPlatform } from '@app/db';
import type { WebhookEvent } from '@app/shared-type';
import { JiraHandler } from './handlers/jira.handler';
import { GitLabHandler } from './handlers/gitlab.handler';
import { GitHubHandler } from './handlers/github.handler';
import { LinearHandler } from './handlers/linear.handler';
import { v4 } from 'uuid';

@Injectable()
export class WebhookService {
  private handlers: Map<string, { parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> }>;

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
    this.handlers = new Map([
      ['jira', this.jiraHandler],
      ['gitlab', this.gitLabHandler],
      ['github', this.gitHubHandler],
      ['linear', this.linearHandler],
    ]);
  }

  async getWebhookSecret(platform: string, tenantId: string): Promise<string | null> {
    const config = await this.em.findOne(TenantWebhookConfig, {
      tenant: tenantId,
      platform: platform as WebhookPlatform,
    });
    return config?.secretRef || null;
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

    if (platform === 'gitlab') {
      const ciSignal = this.gitLabHandler.parseCiEvent(body);
      if (ciSignal) {
        await this.routeCiSignal(tenantId, ciSignal.branchName, ciSignal.type, ciSignal.details);
        return ResultUtils.ok({ accepted: true, deliveryId: `ci-signal-${Date.now()}` });
      }
      const reviewSignal = this.gitLabHandler.parseReviewEvent(body);
      if (reviewSignal) {
        await this.routeReviewSignal(tenantId, reviewSignal.branchName, reviewSignal.type, reviewSignal.reviewer, reviewSignal.comment);
        return ResultUtils.ok({ accepted: true, deliveryId: `review-signal-${Date.now()}` });
      }
    }

    if (platform === 'github') {
      const ciSignal = this.gitHubHandler.parseCiEvent(headers, body);
      if (ciSignal) {
        await this.routeCiSignal(tenantId, ciSignal.branchName, ciSignal.type, ciSignal.details);
        return ResultUtils.ok({ accepted: true, deliveryId: `ci-signal-${Date.now()}` });
      }
      const reviewSignal = this.gitHubHandler.parseReviewEvent(headers, body);
      if (reviewSignal) {
        await this.routeReviewSignal(tenantId, reviewSignal.branchName, reviewSignal.type, reviewSignal.reviewer, reviewSignal.comment);
        return ResultUtils.ok({ accepted: true, deliveryId: `review-signal-${Date.now()}` });
      }
    }

    const parseResult = handler.parse(headers, body, tenantId);
    if (parseResult.isErr()) return err(parseResult.error);

    const event = parseResult.value;
    if (!event) {
      return ResultUtils.ok({ accepted: true, deliveryId: 'ignored' });
    }

    if (platform === 'linear' && !event.repoUrl) {
      event.repoUrl = await this.linearHandler.resolveRepoUrl(tenantId, body);
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
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        this.logger.warn(`Duplicate webhook ignored: ${event.deliveryId}`);
        return ResultUtils.ok({ accepted: true, deliveryId: 'duplicate' });
      }
      return ResultUtils.err('INTERNAL_ERROR', (error as Error).message);
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

  private async routeCiSignal(tenantId: string, branchName: string, type: string, details: string): Promise<void> {
    const mirror = await this.em.findOne(WorkflowMirror, {
      tenant: tenantId,
      branchName,
      state: { $in: [WorkflowStatus.CI_WATCH, WorkflowStatus.CI_FIXING] },
    });

    if (!mirror) {
      this.logger.warn(`No active workflow found for branch ${branchName} in CI state`);
      return;
    }

    try {
      const client = await this.temporalClient.getClient();
      const handle = client.workflow.getHandle(mirror.temporalWorkflowId);

      if (type === 'pipeline_succeeded') {
        await handle.signal('pipelineSucceeded', { details });
        this.logger.log(`Signaled pipeline succeeded for workflow ${mirror.temporalWorkflowId}`);
      } else {
        await handle.signal('pipelineFailed', { details });
        this.logger.log(`Signaled pipeline failed for workflow ${mirror.temporalWorkflowId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to signal workflow: ${(error as Error).message}`);
    }
  }

  private async routeReviewSignal(
    tenantId: string, branchName: string, type: string, reviewer: string, comment?: string,
  ): Promise<void> {
    const mirror = await this.em.findOne(WorkflowMirror, {
      tenant: tenantId,
      branchName,
      state: { $in: [WorkflowStatus.IN_REVIEW, WorkflowStatus.REVIEW_FIXING] },
    });

    if (!mirror) {
      this.logger.warn(`No active workflow found for branch ${branchName} in review state`);
      return;
    }

    try {
      const client = await this.temporalClient.getClient();
      const handle = client.workflow.getHandle(mirror.temporalWorkflowId);

      if (type === 'approved') {
        await handle.signal('gateDecision', {
          workflowId: mirror.temporalWorkflowId,
          gateId: 'review',
          action: 'approve',
          reviewer,
          timestamp: new Date(),
        });
        this.logger.log(`Signaled approval for workflow ${mirror.temporalWorkflowId}`);
      } else {
        await handle.signal('changesRequested', { reviewer, comment });
        this.logger.log(`Signaled changes requested for workflow ${mirror.temporalWorkflowId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to signal workflow: ${(error as Error).message}`);
    }
  }
}
