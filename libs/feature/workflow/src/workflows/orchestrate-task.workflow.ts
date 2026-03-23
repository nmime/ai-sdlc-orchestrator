import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  sleep,
  ApplicationFailure,
} from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, StepResult } from '@ai-sdlc/shared-type';
import type { GateDecision } from '@ai-sdlc/shared-type';
import type * as activitiesType from '../activities';

const {
  updateWorkflowMirror,
  reserveBudget,
  createSandbox,
  invokeAgent,
  destroySandbox,
  verifyAgentOutput,
  collectArtifacts,
  recordCost,
} = proxyActivities<typeof activitiesType>({
  startToCloseTimeout: '30m',
  retry: { maximumAttempts: 3 },
});

export const gateDecisionSignal = defineSignal<[GateDecision]>('gateDecision');
export const ciResultSignal = defineSignal<[{ passed: boolean; details: string }]>('ciResult');
export const reviewResultSignal = defineSignal<[{ approved: boolean; reviewer: string; comment?: string }]>('reviewResult');

export async function orchestrateTaskWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  let totalCostUsd = 0;
  let mrUrl: string | undefined;
  const artifacts: { type: string; name: string; url: string }[] = [];

  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: '', // filled by activity from workflow info
    status: 'running',
    taskExternalId: input.taskExternalId,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    repoUrl: input.repoUrl,
  });

  // Step 1: Reserve budget
  const startBudget = Date.now();
  try {
    await reserveBudget({ tenantId: input.tenantId, amountUsd: 50 });
    steps.push({ stepName: 'reserve_budget', status: 'completed', durationMs: Date.now() - startBudget, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'reserve_budget', status: 'failed', durationMs: Date.now() - startBudget, costUsd: 0, errorMessage: (error as Error).message });
    await updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: '', status: 'failed' });
    return { success: false, steps, totalCostUsd, artifacts };
  }

  // Step 2: Create sandbox
  let sandboxId: string;
  const startSandbox = Date.now();
  try {
    const result = await createSandbox({ tenantId: input.tenantId, repoUrl: input.repoUrl });
    sandboxId = result.sandboxId;
    steps.push({ stepName: 'create_sandbox', status: 'completed', durationMs: Date.now() - startSandbox, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'create_sandbox', status: 'failed', durationMs: Date.now() - startSandbox, costUsd: 0, errorMessage: (error as Error).message });
    await updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: '', status: 'failed' });
    return { success: false, steps, totalCostUsd, artifacts };
  }

  // Step 3: Invoke agent (with adaptive retry loop)
  let agentSuccess = false;
  let retryCount = 0;
  const maxRetries = 3;
  let previousFeedback: string | undefined;
  let noProgressCount = 0;

  while (!agentSuccess && retryCount <= maxRetries) {
    const startAgent = Date.now();
    try {
      const agentResult = await invokeAgent({
        tenantId: input.tenantId,
        sandboxId,
        taskTitle: input.taskTitle,
        taskDescription: input.taskDescription || '',
        repoUrl: input.repoUrl,
        previousFeedback,
      });

      const agentCost = agentResult.aiCostUsd + agentResult.sandboxCostUsd;
      totalCostUsd += agentCost;

      if (agentResult.success) {
        agentSuccess = true;
        mrUrl = agentResult.mrUrl;
        steps.push({ stepName: `invoke_agent_${retryCount}`, status: 'completed', durationMs: Date.now() - startAgent, costUsd: agentCost });

        if (agentResult.artifacts) {
          artifacts.push(...agentResult.artifacts);
        }
      } else {
        previousFeedback = agentResult.errorMessage;
        noProgressCount++;

        if (noProgressCount >= 3) {
          steps.push({ stepName: `invoke_agent_${retryCount}`, status: 'failed', durationMs: Date.now() - startAgent, costUsd: agentCost, errorMessage: 'No progress detected after 3 attempts' });
          break;
        }

        steps.push({ stepName: `invoke_agent_${retryCount}`, status: 'failed', durationMs: Date.now() - startAgent, costUsd: agentCost, errorMessage: agentResult.errorMessage });
      }
    } catch (error) {
      steps.push({ stepName: `invoke_agent_${retryCount}`, status: 'failed', durationMs: Date.now() - startAgent, costUsd: 0, errorMessage: (error as Error).message });
    }
    retryCount++;
  }

  // Step 4: Verify output
  if (agentSuccess) {
    const startVerify = Date.now();
    try {
      await verifyAgentOutput({ sandboxId, repoUrl: input.repoUrl });
      steps.push({ stepName: 'verify_output', status: 'completed', durationMs: Date.now() - startVerify, costUsd: 0 });
    } catch (error) {
      steps.push({ stepName: 'verify_output', status: 'failed', durationMs: Date.now() - startVerify, costUsd: 0, errorMessage: (error as Error).message });
      agentSuccess = false;
    }
  }

  // Step 5: Gate (wait for human approval)
  if (agentSuccess) {
    await updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: '', status: 'awaiting_gate' });

    let gateDecision: GateDecision | null = null;
    setHandler(gateDecisionSignal, (decision: GateDecision) => {
      gateDecision = decision;
    });

    const gateTimeout = await condition(() => gateDecision !== null, '24h');

    if (!gateTimeout || !gateDecision) {
      steps.push({ stepName: 'gate_approval', status: 'failed', durationMs: 0, costUsd: 0, errorMessage: 'Gate timed out' });
      agentSuccess = false;
    } else if ((gateDecision as GateDecision).action === 'reject') {
      steps.push({ stepName: 'gate_approval', status: 'failed', durationMs: 0, costUsd: 0, errorMessage: `Rejected by ${(gateDecision as GateDecision).reviewer}: ${(gateDecision as GateDecision).comment}` });
      agentSuccess = false;
    } else {
      steps.push({ stepName: 'gate_approval', status: 'completed', durationMs: 0, costUsd: 0 });
    }
  }

  // Step 6: Collect artifacts
  if (agentSuccess) {
    try {
      const collectedArtifacts = await collectArtifacts({ sandboxId });
      artifacts.push(...collectedArtifacts);
    } catch {
      // non-fatal
    }
  }

  // Step 7: Destroy sandbox
  try {
    await destroySandbox({ sandboxId });
    steps.push({ stepName: 'destroy_sandbox', status: 'completed', durationMs: 0, costUsd: 0 });
  } catch {
    // non-fatal
  }

  // Record final cost
  await recordCost({ tenantId: input.tenantId, totalCostUsd });

  const finalStatus = agentSuccess ? 'completed' : 'failed';
  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: '',
    status: finalStatus,
    totalCostUsd,
    mrUrl,
  });

  return { success: agentSuccess, steps, totalCostUsd, mrUrl, artifacts };
}
