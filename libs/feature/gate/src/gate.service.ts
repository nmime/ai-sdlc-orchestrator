import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService, TemporalClientService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import type { GateDecision, GateAction } from '@ai-sdlc/shared-type';

@Injectable()
export class GateService {
  constructor(
    private readonly temporalClient: TemporalClientService,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('GateService');
  }

  async submitDecision(
    workflowId: string,
    action: GateAction,
    reviewer: string,
    comment?: string,
  ): Promise<Result<GateDecision, AppError>> {
    try {
      const client = await this.temporalClient.getClient();
      const handle = client.workflow.getHandle(workflowId);

      const decision: GateDecision = {
        workflowId,
        gateId: workflowId,
        action,
        reviewer,
        comment,
        timestamp: new Date(),
      };

      await handle.signal('gateDecision', decision);

      this.logger.log(`Gate decision for ${workflowId}: ${action}`);
      return ResultUtils.ok(decision);
    } catch (error) {
      return ResultUtils.err('TEMPORAL_ERROR', `Failed to signal workflow: ${(error as Error).message}`);
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<Result<{ status: string; runId: string }, AppError>> {
    try {
      const client = await this.temporalClient.getClient();
      const handle = client.workflow.getHandle(workflowId);
      const desc = await handle.describe();

      return ResultUtils.ok({
        status: desc.status.name,
        runId: desc.runId,
      });
    } catch (error) {
      return ResultUtils.err('TEMPORAL_ERROR', (error as Error).message);
    }
  }

  async cancelWorkflow(workflowId: string, reason: string): Promise<Result<void, AppError>> {
    try {
      const client = await this.temporalClient.getClient();
      const handle = client.workflow.getHandle(workflowId);
      await handle.cancel();

      this.logger.log(`Workflow ${workflowId} cancelled: ${reason}`);
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('TEMPORAL_ERROR', (error as Error).message);
    }
  }
}
