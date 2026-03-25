import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,

  workflowInfo,
} from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, StepResult, PublishedArtifact, SessionContext } from '@app/shared-type';
import type { GateDecision } from '@app/shared-type';
import type * as activitiesType from '../activities';

const {
  updateWorkflowMirror,
  reserveBudget,
  settleCost,
  createSandbox,
  invokeAgent,
  destroySandbox,
  pauseSandbox,
  resumeSandbox,
  verifyAgentOutput,
  collectArtifacts,

  checkConcurrency,
  checkAdmission,
} = proxyActivities<typeof activitiesType>({
  startToCloseTimeout: '65m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '60s',
  },
});

export const gateDecisionSignal = defineSignal<[GateDecision]>('gateDecision');
export const pipelineSucceededSignal = defineSignal<[{ details: string }]>('pipelineSucceeded');
export const pipelineFailedSignal = defineSignal<[{ details: string }]>('pipelineFailed');
export const changesRequestedSignal = defineSignal<[{ reviewer: string; comment?: string }]>('changesRequested');
export const mrMergedSignal = defineSignal<[{ mrUrl: string }]>('mrMerged');
export const taskUpdatedSignal = defineSignal<[{ payload: Record<string, unknown> }]>('taskUpdated');
export const workflowUnblockSignal = defineSignal<[{ reason: string }]>('workflowUnblock');


export async function orchestrateTaskWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const wfInfo = workflowInfo();
  const steps: StepResult[] = [];
  let totalAiCostUsd = 0;
  let totalSandboxCostUsd = 0;
  let mrUrl: string | undefined = undefined;
  let branchName: string | undefined = undefined;
  const artifacts: PublishedArtifact[] = [];
  let sandboxId: string | undefined;
  let currentStepId = 'implement';

  let gateDecision: GateDecision | null = null;
  let pipelineSucceeded = false;
  let pipelineFailed = false;
  let _pipelineDetails = '';
  let changesRequested = false;
  let _changesReviewer = '';
  let _changesComment = '';
  let _unblockRequested = false;
  let _unblockReason = '';

  setHandler(gateDecisionSignal, (d) => { gateDecision = d; });
  setHandler(pipelineSucceededSignal, (d) => { pipelineSucceeded = true; _pipelineDetails = d.details; });
  setHandler(pipelineFailedSignal, (d) => { pipelineFailed = true; _pipelineDetails = d.details; });
  setHandler(changesRequestedSignal, (d) => { changesRequested = true; _changesReviewer = d.reviewer; _changesComment = d.comment ?? ''; });
  setHandler(taskUpdatedSignal, () => {});
  setHandler(workflowUnblockSignal, (d) => { _unblockRequested = true; _unblockReason = d.reason; });

  const _totalCostUsd = () => totalAiCostUsd + totalSandboxCostUsd;
  const mirrorUpdate = (state: string, extra?: Record<string, unknown>) =>
    updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: wfInfo.workflowId, state, currentStepId, ...extra });

  await mirrorUpdate('implementing', {
    taskId: input.taskId,
    taskProvider: input.taskProvider,
    repoId: input.repoId,
    repoUrl: input.repoUrl,
    dslName: input.dslName,
    dslVersion: input.dslVersion,
  });

  try {
    await checkConcurrency({ tenantId: input.tenantId, repoId: input.repoId });
  } catch (error) {
    await mirrorUpdate('blocked_recoverable', { errorMessage: (error as Error).message });
    return buildResult(false, steps, 0, 0, artifacts, mrUrl, branchName, (error as Error).message);
  }

  const startBudget = Date.now();
  try {
    await reserveBudget({ tenantId: input.tenantId, estimatedCostUsd: 50, repoId: input.repoId });
    steps.push({ stepName: 'reserve_budget', status: 'completed', durationMs: Date.now() - startBudget, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'reserve_budget', status: 'failed', durationMs: Date.now() - startBudget, costUsd: 0, errorMessage: (error as Error).message });
    await mirrorUpdate('blocked_terminal');
    return buildResult(false, steps, 0, 0, artifacts, mrUrl, branchName, (error as Error).message);
  }

  try {
    await checkAdmission({ tenantId: input.tenantId });
  } catch (error) {
    await mirrorUpdate('blocked_recoverable', { errorMessage: (error as Error).message });
    return buildResult(false, steps, 0, 0, artifacts, mrUrl, branchName, (error as Error).message);
  }

  const startSandbox = Date.now();
  try {
    const result = await createSandbox({ tenantId: input.tenantId, repoUrl: input.repoUrl });
    sandboxId = result.sandboxId;
    steps.push({ stepName: 'create_sandbox', status: 'completed', durationMs: Date.now() - startSandbox, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'create_sandbox', status: 'failed', durationMs: Date.now() - startSandbox, costUsd: 0, errorMessage: (error as Error).message });
    await mirrorUpdate('blocked_recoverable');
    return buildResult(false, steps, 0, 0, artifacts, mrUrl, branchName, (error as Error).message);
  }

  const activeSandboxId = sandboxId as string;

  currentStepId = 'implement';
  const implementResult = await runAgentStep({
    stepId: 'implement',
    mode: 'implement',
    sandboxId: activeSandboxId,
    input,
    steps,
    temporalWorkflowId: wfInfo.workflowId,
  });

  if (!implementResult.success) {
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Implementation failed');
  }
  totalAiCostUsd += implementResult.aiCostUsd;
  totalSandboxCostUsd += implementResult.sandboxCostUsd;
  branchName = implementResult.branchName;
  mrUrl = implementResult.mrUrl;
  if (implementResult.artifacts) artifacts.push(...implementResult.artifacts);

  currentStepId = 'ci_watch';
  await mirrorUpdate('ci_watch', { branchName, mrUrl });

  if (sandboxId) {
    try { await pauseSandbox({ sandboxId }); } catch { /* non-fatal */ }
  }

  pipelineSucceeded = false;
  pipelineFailed = false;
  const ciResolved = await condition(() => pipelineSucceeded || pipelineFailed, '2h');

  if (!ciResolved) {
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'CI watch timed out');
  }

  if (pipelineFailed) {
    const ciFixResult = await runFixLoop({
      loopId: 'ci_fix',
      mode: 'ci_fix',
      maxIterations: 5,
      noProgressLimit: 2,
      sandboxId: activeSandboxId,
      input,
      steps,
      previousContext: implementResult.sessionContext,
      temporalWorkflowId: wfInfo.workflowId,
    });
    totalAiCostUsd += ciFixResult.totalAiCostUsd;
    totalSandboxCostUsd += ciFixResult.totalSandboxCostUsd;

    if (!ciFixResult.success) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'CI fix loop exhausted');
    }
  }

  currentStepId = 'verify_output';
  const startVerify = Date.now();
  try {
    await verifyAgentOutput({ sandboxId: activeSandboxId, repoUrl: input.repoUrl, branchName });
    steps.push({ stepName: 'verify_output', status: 'completed', durationMs: Date.now() - startVerify, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'verify_output', status: 'failed', durationMs: Date.now() - startVerify, costUsd: 0, errorMessage: (error as Error).message });
  }

  currentStepId = 'review_gate';
  await mirrorUpdate('in_review');
  gateDecision = null;
  changesRequested = false;

  const gateResolved = await condition(
    () => gateDecision !== null || changesRequested,
    '72h',
  );

  if (!gateResolved) {
    steps.push({ stepName: 'review_gate', status: 'failed', durationMs: 0, costUsd: 0, errorMessage: 'Review gate timed out (72h)' });
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Review gate timed out');
  }

  if (changesRequested || (gateDecision && (gateDecision as GateDecision).action === 'request_changes')) {
    currentStepId = 'review_fix_loop';
    await mirrorUpdate('review_fixing');

    const reviewFixResult = await runFixLoop({
      loopId: 'review_fix',
      mode: 'review_fix',
      maxIterations: 5,
      noProgressLimit: 2,
      sandboxId: activeSandboxId,
      input,
      steps,
      previousContext: implementResult.sessionContext,
      temporalWorkflowId: wfInfo.workflowId,
    });
    totalAiCostUsd += reviewFixResult.totalAiCostUsd;
    totalSandboxCostUsd += reviewFixResult.totalSandboxCostUsd;

    if (!reviewFixResult.success) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Review fix loop exhausted');
    }

    pipelineSucceeded = false;
    pipelineFailed = false;
    await mirrorUpdate('ci_watch');
    const ciResolved2 = await condition(() => pipelineSucceeded || pipelineFailed, '2h');
    if (!ciResolved2 || pipelineFailed) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Post-review CI failed');
    }
  }

  steps.push({ stepName: 'review_gate', status: 'completed', durationMs: 0, costUsd: 0 });

  if (sandboxId) {
    try {
      const collected = await collectArtifacts({ sandboxId, tenantId: input.tenantId, temporalWorkflowId: wfInfo.workflowId });
      artifacts.push(...collected);
    } catch { /* non-fatal */ }
  }

  await cleanupAndFinish('completed', sandboxId, input, steps, artifacts, totalAiCostUsd, totalSandboxCostUsd, wfInfo.workflowId);
  return buildResult(true, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName);
}

async function runAgentStep(params: {
  stepId: string;
  mode: 'implement' | 'ci_fix' | 'review_fix';
  sandboxId: string;
  input: WorkflowInput;
  steps: StepResult[];
  previousContext?: SessionContext;
  temporalWorkflowId: string;
  loopIteration?: number;
}): Promise<{
  success: boolean;
  aiCostUsd: number;
  sandboxCostUsd: number;
  branchName?: string;
  mrUrl?: string;
  artifacts?: PublishedArtifact[];
  sessionContext?: SessionContext;
}> {
  const start = Date.now();
  try {
    const result = await invokeAgent({
      tenantId: params.input.tenantId,
      temporalWorkflowId: params.temporalWorkflowId,
      sandboxId: params.sandboxId,
      mode: params.mode,
      repoUrl: params.input.repoUrl,
      repoId: params.input.repoId,
      loopIteration: params.loopIteration,
      previousContext: params.previousContext,
      taskLabel: params.input.labels?.[0],
    });

    const aiCost = result.cost?.ai?.usd ?? 0;
    const sandboxCost = result.cost?.sandbox?.usd ?? 0;

    if (result.status === 'success') {
      params.steps.push({ stepName: params.stepId, status: 'completed', durationMs: Date.now() - start, costUsd: aiCost + sandboxCost });
      return {
        success: true,
        aiCostUsd: aiCost,
        sandboxCostUsd: sandboxCost,
        branchName: result.branchName,
        mrUrl: result.mrUrl,
        artifacts: result.artifacts,
        sessionContext: {
          summary: result.summary,
          filesModified: result.diffStats?.filesChanged ?? [],
          branchName: result.branchName ?? '',
          mrUrl: result.mrUrl,
          toolCallsSummary: result.toolCalls.map(tc => `${tc.toolName}: ${tc.status}`),
          errorCode: result.errorCode,
        },
      };
    }

    params.steps.push({ stepName: params.stepId, status: 'failed', durationMs: Date.now() - start, costUsd: aiCost + sandboxCost, errorMessage: result.errorMessage });
    return { success: false, aiCostUsd: aiCost, sandboxCostUsd: sandboxCost };
  } catch (error) {
    params.steps.push({ stepName: params.stepId, status: 'failed', durationMs: Date.now() - start, costUsd: 0, errorMessage: (error as Error).message });
    return { success: false, aiCostUsd: 0, sandboxCostUsd: 0 };
  }
}

async function runFixLoop(params: {
  loopId: string;
  mode: 'ci_fix' | 'review_fix';
  maxIterations: number;
  noProgressLimit: number;
  sandboxId: string;
  input: WorkflowInput;
  steps: StepResult[];
  previousContext?: SessionContext;
  temporalWorkflowId: string;
}): Promise<{ success: boolean; totalAiCostUsd: number; totalSandboxCostUsd: number }> {
  let totalAiCostUsd = 0;
  let totalSandboxCostUsd = 0;
  let noProgressCount = 0;
  let lastContext = params.previousContext;

  for (let i = 0; i < params.maxIterations; i++) {
    try {
      const resumed = await resumeSandbox({ sandboxId: params.sandboxId });
      if (resumed.sandboxId) params.sandboxId = resumed.sandboxId;
    } catch { /* fresh sandbox needed */ }

    const result = await runAgentStep({
      stepId: `${params.loopId}_${i}`,
      mode: params.mode,
      sandboxId: params.sandboxId,
      input: params.input,
      steps: params.steps,
      previousContext: lastContext,
      temporalWorkflowId: params.temporalWorkflowId,
      loopIteration: i,
    });

    totalAiCostUsd += result.aiCostUsd;
    totalSandboxCostUsd += result.sandboxCostUsd;
    lastContext = result.sessionContext;

    if (result.success) return { success: true, totalAiCostUsd, totalSandboxCostUsd };

    noProgressCount++;
    if (noProgressCount >= params.noProgressLimit) break;
  }

  return { success: false, totalAiCostUsd, totalSandboxCostUsd };
}

async function cleanupAndFinish(
  finalState: string,
  sandboxId: string | undefined,
  input: WorkflowInput,
  steps: StepResult[],
  artifacts: PublishedArtifact[],
  aiCostUsd: number,
  sandboxCostUsd: number,
  temporalWorkflowId: string,
) {
  if (sandboxId) {
    try { await destroySandbox({ sandboxId }); } catch { /* non-fatal */ }
  }

  try {
    await settleCost({
      tenantId: input.tenantId,
      workflowId: temporalWorkflowId,
      reservedUsd: 50,
      actualAiCostUsd: aiCostUsd,
      actualSandboxCostUsd: sandboxCostUsd,
      actualTotalCostUsd: aiCostUsd + sandboxCostUsd,
    });
  } catch { /* non-fatal */ }

  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId,
    state: finalState,
    costUsdTotal: aiCostUsd + sandboxCostUsd,
    aiCostUsd,
    sandboxCostUsd,
  });
}

function buildResult(
  success: boolean,
  steps: StepResult[],
  aiCostUsd: number,
  sandboxCostUsd: number,
  artifacts: PublishedArtifact[],
  mrUrl?: string,
  branchName?: string,
  errorMessage?: string,
): WorkflowResult {
  return {
    success,
    steps,
    totalCostUsd: aiCostUsd + sandboxCostUsd,
    aiCostUsd,
    sandboxCostUsd,
    mrUrl,
    branchName,
    artifacts,
    errorMessage,
  };
}
