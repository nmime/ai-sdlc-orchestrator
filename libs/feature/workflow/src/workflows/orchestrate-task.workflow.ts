import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  ApplicationFailure,
} from '@temporalio/workflow';
import type { WorkflowInput, WorkflowResult, StepResult, PublishedArtifact, SessionContext } from '@ai-sdlc/shared-type';
import type { GateDecision } from '@ai-sdlc/shared-type';
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
  cleanupAndEscalate,
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

interface LoopState {
  iteration: number;
  noProgressCount: number;
  lastSessionContext?: SessionContext;
}

export async function orchestrateTaskWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const steps: StepResult[] = [];
  let totalAiCostUsd = 0;
  let totalSandboxCostUsd = 0;
  let mrUrl: string | undefined;
  let branchName: string | undefined;
  const artifacts: PublishedArtifact[] = [];
  let sandboxId: string | undefined;
  let currentStepId = 'implement';
  let blockedStepId: string | undefined;

  let gateDecision: GateDecision | null = null;
  let pipelineSucceeded = false;
  let pipelineFailed = false;
  let pipelineDetails = '';
  let changesRequested = false;
  let changesReviewer = '';
  let changesComment = '';
  let unblockRequested = false;
  let unblockReason = '';

  setHandler(gateDecisionSignal, (d) => { gateDecision = d; });
  setHandler(pipelineSucceededSignal, (d) => { pipelineSucceeded = true; pipelineDetails = d.details; });
  setHandler(pipelineFailedSignal, (d) => { pipelineFailed = true; pipelineDetails = d.details; });
  setHandler(changesRequestedSignal, (d) => { changesRequested = true; changesReviewer = d.reviewer; changesComment = d.comment ?? ''; });
  setHandler(taskUpdatedSignal, () => {});
  setHandler(workflowUnblockSignal, (d) => { unblockRequested = true; unblockReason = d.reason; });

  const totalCostUsd = () => totalAiCostUsd + totalSandboxCostUsd;
  const mirrorUpdate = (state: string, extra?: Record<string, unknown>) =>
    updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: '', state, currentStepId, ...extra });

  await mirrorUpdate('implementing', {
    taskId: input.taskId,
    taskProvider: input.taskProvider,
    repoId: input.repoId,
    repoUrl: input.repoUrl,
    dslName: input.dslName,
    dslVersion: input.dslVersion,
  });

  const startBudget = Date.now();
  try {
    await reserveBudget({ tenantId: input.tenantId, estimatedCostUsd: 50 });
    steps.push({ stepName: 'reserve_budget', status: 'completed', durationMs: Date.now() - startBudget, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'reserve_budget', status: 'failed', durationMs: Date.now() - startBudget, costUsd: 0, errorMessage: (error as Error).message });
    await mirrorUpdate('blocked_terminal');
    return { success: false, steps, totalCostUsd: 0, aiCostUsd: 0, sandboxCostUsd: 0, artifacts, errorMessage: (error as Error).message };
  }

  const startSandbox = Date.now();
  try {
    const result = await createSandbox({ tenantId: input.tenantId, repoUrl: input.repoUrl });
    sandboxId = result.sandboxId;
    steps.push({ stepName: 'create_sandbox', status: 'completed', durationMs: Date.now() - startSandbox, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'create_sandbox', status: 'failed', durationMs: Date.now() - startSandbox, costUsd: 0, errorMessage: (error as Error).message });
    await mirrorUpdate('blocked_recoverable');
    return { success: false, steps, totalCostUsd: 0, aiCostUsd: 0, sandboxCostUsd: 0, artifacts, errorMessage: (error as Error).message };
  }

  // --- IMPLEMENT ---
  currentStepId = 'implement';
  const implementResult = await runAgentStep({
    stepId: 'implement',
    mode: 'implement',
    sandboxId: sandboxId!,
    input,
    steps,
  });

  if (!implementResult.success) {
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Implementation failed');
  }
  totalAiCostUsd += implementResult.aiCostUsd;
  totalSandboxCostUsd += implementResult.sandboxCostUsd;
  branchName = implementResult.branchName;
  mrUrl = implementResult.mrUrl;
  if (implementResult.artifacts) artifacts.push(...implementResult.artifacts);

  // --- CI WATCH ---
  currentStepId = 'ci_watch';
  await mirrorUpdate('ci_watch', { branchName, mrUrl });

  if (sandboxId) {
    try { await pauseSandbox({ sandboxId }); } catch { /* non-fatal */ }
  }

  pipelineSucceeded = false;
  pipelineFailed = false;
  const ciResolved = await condition(() => pipelineSucceeded || pipelineFailed, '2h');

  if (!ciResolved) {
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'CI watch timed out');
  }

  if (pipelineFailed) {
    // --- CI FIX LOOP ---
    const ciFixResult = await runFixLoop({
      loopId: 'ci_fix',
      mode: 'ci_fix',
      maxIterations: 5,
      noProgressLimit: 2,
      sandboxId: sandboxId!,
      input,
      steps,
      previousContext: implementResult.sessionContext,
    });
    totalAiCostUsd += ciFixResult.totalAiCostUsd;
    totalSandboxCostUsd += ciFixResult.totalSandboxCostUsd;

    if (!ciFixResult.success) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'CI fix loop exhausted');
    }
  }

  // --- VERIFY OUTPUT ---
  currentStepId = 'verify_output';
  const startVerify = Date.now();
  try {
    await verifyAgentOutput({ sandboxId: sandboxId!, repoUrl: input.repoUrl, branchName });
    steps.push({ stepName: 'verify_output', status: 'completed', durationMs: Date.now() - startVerify, costUsd: 0 });
  } catch (error) {
    steps.push({ stepName: 'verify_output', status: 'failed', durationMs: Date.now() - startVerify, costUsd: 0, errorMessage: (error as Error).message });
  }

  // --- REVIEW GATE ---
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
    await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
    return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Review gate timed out');
  }

  if (changesRequested || (gateDecision && gateDecision.action === 'request_changes')) {
    // --- REVIEW FIX LOOP ---
    currentStepId = 'review_fix_loop';
    await mirrorUpdate('review_fixing');

    const reviewFixResult = await runFixLoop({
      loopId: 'review_fix',
      mode: 'review_fix',
      maxIterations: 5,
      noProgressLimit: 2,
      sandboxId: sandboxId!,
      input,
      steps,
      previousContext: implementResult.sessionContext,
    });
    totalAiCostUsd += reviewFixResult.totalAiCostUsd;
    totalSandboxCostUsd += reviewFixResult.totalSandboxCostUsd;

    if (!reviewFixResult.success) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Review fix loop exhausted');
    }

    // Re-enter CI watch after review fix
    pipelineSucceeded = false;
    pipelineFailed = false;
    await mirrorUpdate('ci_watch');
    const ciResolved2 = await condition(() => pipelineSucceeded || pipelineFailed, '2h');
    if (!ciResolved2 || pipelineFailed) {
      await cleanupAndFinish('blocked_terminal', sandboxId, input, steps, artifacts);
      return buildResult(false, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName, 'Post-review CI failed');
    }
  }

  steps.push({ stepName: 'review_gate', status: 'completed', durationMs: 0, costUsd: 0 });

  // --- COLLECT ARTIFACTS ---
  if (sandboxId) {
    try {
      const collected = await collectArtifacts({ sandboxId });
      artifacts.push(...collected);
    } catch { /* non-fatal */ }
  }

  // --- DONE ---
  await cleanupAndFinish('completed', sandboxId, input, steps, artifacts);
  return buildResult(true, steps, totalAiCostUsd, totalSandboxCostUsd, artifacts, mrUrl, branchName);
}

async function runAgentStep(params: {
  stepId: string;
  mode: 'implement' | 'ci_fix' | 'review_fix';
  sandboxId: string;
  input: WorkflowInput;
  steps: StepResult[];
  previousContext?: SessionContext;
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
      sandboxId: params.sandboxId,
      mode: params.mode,
      repoUrl: params.input.repoUrl,
      previousContext: params.previousContext,
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
}): Promise<{ success: boolean; totalAiCostUsd: number; totalSandboxCostUsd: number }> {
  let totalAiCostUsd = 0;
  let totalSandboxCostUsd = 0;
  let noProgressCount = 0;
  let lastContext = params.previousContext;

  for (let i = 0; i < params.maxIterations; i++) {
    try {
      const resumed = await resumeSandbox({ sandboxId: params.sandboxId });
      if (resumed.sandboxId) params.sandboxId = resumed.sandboxId;
    } catch { /* fresh sandbox needed — handled by invokeAgent */ }

    const result = await runAgentStep({
      stepId: `${params.loopId}_${i}`,
      mode: params.mode,
      sandboxId: params.sandboxId,
      input: params.input,
      steps: params.steps,
      previousContext: lastContext,
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
) {
  if (sandboxId) {
    try { await destroySandbox({ sandboxId }); } catch { /* non-fatal */ }
  }

  try {
    await settleCost({ tenantId: input.tenantId, reservedUsd: 50 });
  } catch { /* non-fatal */ }

  await updateWorkflowMirror({ tenantId: input.tenantId, temporalWorkflowId: '', state: finalState });
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
