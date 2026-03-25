import {
  proxyActivities,
  startChild,
  defineSignal,
  setHandler,
  CancellationScope,
} from '@temporalio/workflow';
import type { PublishedArtifact } from '@app/shared-type';
import type * as activitiesType from '../activities';
import { orchestrateTaskWorkflow } from './orchestrate-task.workflow';

const { updateWorkflowMirror } = proxyActivities<typeof activitiesType>({
  startToCloseTimeout: '5m',
});

export interface MultiRepoInput {
  tenantId: string;
  parentTaskId: string;
  taskProvider: string;
  repos: Array<{
    repoId: string;
    repoUrl: string;
    taskId: string;
    labels?: string[];
  }>;
  failureStrategy: 'wait_all' | 'fail_fast';
  webhookDeliveryId: string;
}

export interface MultiRepoResult {
  success: boolean;
  results: Array<{ repoId: string; success: boolean; mrUrl?: string; errorMessage?: string }>;
  totalCostUsd: number;
  artifacts: PublishedArtifact[];
}

export const cancelChildrenSignal = defineSignal('cancelChildren');

export async function multiRepoWorkflow(input: MultiRepoInput): Promise<MultiRepoResult> {
  let cancelRequested = false;
  setHandler(cancelChildrenSignal, () => { cancelRequested = true; });

  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: `multi-repo-${input.parentTaskId}`,
    state: 'implementing',
    taskId: input.parentTaskId,
    taskProvider: input.taskProvider,
  });

  const results: Array<{ repoId: string; success: boolean; mrUrl?: string; errorMessage?: string; costUsd: number }> = [];
  const allArtifacts: PublishedArtifact[] = [];
  let totalCost = 0;

  if (input.failureStrategy === 'fail_fast') {
    await CancellationScope.cancellable(async () => {
      const childHandles = input.repos.map(repo =>
        startChild(orchestrateTaskWorkflow, {
          workflowId: `orchestrate-${input.tenantId}-${repo.taskId}`,
          args: [{
            tenantId: input.tenantId,
            taskId: repo.taskId,
            taskProvider: input.taskProvider,
            repoId: repo.repoId,
            repoUrl: repo.repoUrl,
            webhookDeliveryId: input.webhookDeliveryId,
            labels: repo.labels,
          }],
        }),
      );

      const settled = await Promise.allSettled(childHandles.map(async (handlePromise, idx) => {
        const handle = await handlePromise;
        const result = await handle.result();
        return { repo: input.repos[idx], result };
      }));

      for (const s of settled) {
        if (s.status === 'fulfilled') {
          const { repo, result } = s.value;
          results.push({
            repoId: repo.repoId,
            success: result.success,
            mrUrl: result.mrUrl,
            errorMessage: result.errorMessage,
            costUsd: result.totalCostUsd,
          });
          totalCost += result.totalCostUsd;
          allArtifacts.push(...result.artifacts);
        } else {
          const repo = input.repos[settled.indexOf(s)];
          results.push({
            repoId: repo.repoId,
            success: false,
            errorMessage: s.reason?.message || 'Child workflow failed',
            costUsd: 0,
          });
        }
      }
    });
  } else {
    for (const repo of input.repos) {
      if (cancelRequested) break;

      try {
        const handle = await startChild(orchestrateTaskWorkflow, {
          workflowId: `orchestrate-${input.tenantId}-${repo.taskId}`,
          args: [{
            tenantId: input.tenantId,
            taskId: repo.taskId,
            taskProvider: input.taskProvider,
            repoId: repo.repoId,
            repoUrl: repo.repoUrl,
            webhookDeliveryId: input.webhookDeliveryId,
            labels: repo.labels,
          }],
        });

        const result = await handle.result();
        results.push({
          repoId: repo.repoId,
          success: result.success,
          mrUrl: result.mrUrl,
          errorMessage: result.errorMessage,
          costUsd: result.totalCostUsd,
        });
        totalCost += result.totalCostUsd;
        allArtifacts.push(...result.artifacts);
      } catch (error) {
        results.push({
          repoId: repo.repoId,
          success: false,
          errorMessage: (error as Error).message,
          costUsd: 0,
        });
      }
    }
  }

  const allSuccess = results.every(r => r.success);
  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: `multi-repo-${input.parentTaskId}`,
    state: allSuccess ? 'completed' : 'blocked_terminal',
    costUsdTotal: totalCost,
  });

  return {
    success: allSuccess,
    results: results.map(({ costUsd: _, ...rest }) => rest),
    totalCostUsd: totalCost,
    artifacts: allArtifacts,
  };
}
