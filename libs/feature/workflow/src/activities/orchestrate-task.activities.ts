import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror, WorkflowStatus, WorkflowEvent, Tenant, AgentSession, AgentMode } from '@ai-sdlc/db';
import type { AgentResult, SessionContext, PublishedArtifact } from '@ai-sdlc/shared-type';

let em: EntityManager;
let sandboxAdapter: any;
let agentRegistry: any;
let promptFormatter: any;
let credentialProxy: any;

export function initActivities(deps: {
  em: EntityManager;
  sandboxAdapter: any;
  agentRegistry: any;
  promptFormatter: any;
  credentialProxy: any;
}) {
  em = deps.em;
  sandboxAdapter = deps.sandboxAdapter;
  agentRegistry = deps.agentRegistry;
  promptFormatter = deps.promptFormatter;
  credentialProxy = deps.credentialProxy;
}

export async function updateWorkflowMirror(input: {
  tenantId: string;
  temporalWorkflowId: string;
  state: string;
  currentStepId?: string;
  taskId?: string;
  taskProvider?: string;
  repoId?: string;
  repoUrl?: string;
  branchName?: string;
  mrUrl?: string;
  dslName?: string;
  dslVersion?: number;
  costUsdTotal?: number;
  aiCostUsd?: number;
  sandboxCostUsd?: number;
}): Promise<void> {
  let mirror = await em.findOne(WorkflowMirror, { temporalWorkflowId: input.temporalWorkflowId });

  if (!mirror) {
    mirror = new WorkflowMirror();
    mirror.tenant = em.getReference(Tenant, input.tenantId) as any;
    mirror.temporalWorkflowId = input.temporalWorkflowId;
    mirror.temporalRunId = '';
    mirror.repoId = input.repoId || '';
    mirror.repoUrl = input.repoUrl || '';
    mirror.taskId = input.taskId;
    mirror.taskProvider = input.taskProvider;
    mirror.dslName = input.dslName;
    mirror.dslVersion = input.dslVersion;
    em.persist(mirror);
  }

  const previousState = mirror.state;
  mirror.state = input.state as WorkflowStatus;
  if (input.currentStepId) mirror.currentStepId = input.currentStepId;
  if (input.branchName) mirror.branchName = input.branchName;
  if (input.mrUrl) mirror.mrUrl = input.mrUrl;
  if (input.costUsdTotal !== undefined) mirror.costUsdTotal = input.costUsdTotal;
  if (input.aiCostUsd !== undefined) mirror.aiCostUsd = input.aiCostUsd;
  if (input.sandboxCostUsd !== undefined) mirror.sandboxCostUsd = input.sandboxCostUsd;

  if (input.state === 'completed' || input.state === 'blocked_terminal' || input.state === 'cancelled') {
    mirror.updatedAt = new Date();
  }

  const event = new WorkflowEvent();
  event.workflow = mirror;
  event.eventType = 'state_transition';
  event.fromState = previousState;
  event.toState = input.state;
  em.persist(event);

  await em.flush();
}

export async function reserveBudget(input: { tenantId: string; estimatedCostUsd: number }): Promise<void> {
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });

  const total = Number(tenant.monthlyCostActualUsd) + Number(tenant.monthlyCostReservedUsd) + input.estimatedCostUsd;
  if (tenant.monthlyCostLimitUsd > 0 && total > Number(tenant.monthlyCostLimitUsd)) {
    throw new Error(`Budget exceeded: reserved + actual + estimated ($${total.toFixed(2)}) > limit ($${tenant.monthlyCostLimitUsd})`);
  }

  const updated = await em.nativeUpdate(
    Tenant,
    { id: input.tenantId, budgetVersion: tenant.budgetVersion },
    {
      monthlyCostReservedUsd: Number(tenant.monthlyCostReservedUsd) + input.estimatedCostUsd,
      budgetVersion: tenant.budgetVersion + 1,
    },
  );

  if (updated === 0) {
    throw new Error('Budget concurrency conflict, retry');
  }
}

export async function settleCost(input: { tenantId: string; reservedUsd: number; actualAiCostUsd?: number; actualSandboxCostUsd?: number }): Promise<void> {
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });
  const actualAi = input.actualAiCostUsd ?? 0;
  const actualSandbox = input.actualSandboxCostUsd ?? 0;
  const actualTotal = actualAi + actualSandbox;

  await em.nativeUpdate(
    Tenant,
    { id: input.tenantId, budgetVersion: tenant.budgetVersion },
    {
      monthlyCostReservedUsd: Math.max(0, Number(tenant.monthlyCostReservedUsd) - input.reservedUsd),
      monthlyCostActualUsd: Number(tenant.monthlyCostActualUsd) + actualTotal,
      monthlyAiCostActualUsd: Number(tenant.monthlyAiCostActualUsd) + actualAi,
      monthlySandboxCostActualUsd: Number(tenant.monthlySandboxCostActualUsd) + actualSandbox,
      budgetVersion: tenant.budgetVersion + 1,
    },
  );
}

export async function createSandbox(input: {
  tenantId: string;
  repoUrl: string;
}): Promise<{ sandboxId: string }> {
  const result = await sandboxAdapter.create({
    timeoutMs: 600_000,
    env: { REPO_URL: input.repoUrl },
  });

  if (result.isErr()) {
    throw new Error(result.error.message);
  }

  const { sandboxId } = result.value;

  await sandboxAdapter.exec(sandboxId, `git clone ${input.repoUrl} /workspace && cd /workspace`);

  return { sandboxId };
}

export async function pauseSandbox(input: { sandboxId: string }): Promise<void> {
  await sandboxAdapter.pause(input.sandboxId);
}

export async function resumeSandbox(input: { sandboxId: string }): Promise<{ sandboxId: string }> {
  try {
    const handle = await sandboxAdapter.resume(input.sandboxId);
    return { sandboxId: handle?.sandboxId ?? input.sandboxId };
  } catch {
    return { sandboxId: input.sandboxId };
  }
}

export async function invokeAgent(input: {
  tenantId: string;
  sandboxId: string;
  mode: 'implement' | 'ci_fix' | 'review_fix';
  repoUrl: string;
  previousContext?: SessionContext;
}): Promise<AgentResult> {
  const prompt = promptFormatter.format('claude', {
    taskSeed: `Mode: ${input.mode}`,
    repoInfo: { url: input.repoUrl, branch: 'main', defaultBranch: 'main' },
    workflowInstructions: { qualityGates: ['test', 'lint'] },
    mcpServers: [],
    previousContext: input.previousContext,
  });

  const agent = agentRegistry.getOrThrow('claude');
  const sessionId = `session-${Date.now()}`;
  const result = await agent.invoke({
    sessionId,
    provider: 'claude',
    prompt,
    sandboxId: input.sandboxId,
    maxDurationMs: 3_600_000,
    maxCostUsd: 50,
    credentialProxyUrl: credentialProxy.baseUrl,
  });

  const failureResult = (msg: string): AgentResult => ({
    sessionId,
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    status: 'failure',
    errorMessage: msg,
    summary: '',
    cost: { ai: { inputTokens: 0, outputTokens: 0, usd: 0, provider: 'claude', model: 'claude-sonnet-4-20250514' }, sandbox: { durationSeconds: 0, usd: 0 }, totalUsd: 0 },
    turnCount: 0,
    toolCalls: [],
  });

  if (result.isErr()) {
    return failureResult(result.error.message);
  }

  const output = result.value;
  return {
    sessionId,
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    status: output.success ? 'success' : 'failure',
    errorMessage: output.errorMessage,
    summary: `Agent completed with ${output.filesChanged} files changed`,
    artifacts: output.artifacts,
    cost: {
      ai: { inputTokens: output.inputTokens, outputTokens: output.outputTokens, usd: output.aiCostUsd, provider: 'claude', model: 'claude-sonnet-4-20250514' },
      sandbox: { durationSeconds: 0, usd: output.sandboxCostUsd },
      totalUsd: output.aiCostUsd + output.sandboxCostUsd,
    },
    turnCount: 1,
    toolCalls: [],
    diffStats: { linesAdded: 0, linesRemoved: 0, filesChanged: [] },
  };
}

export async function destroySandbox(input: { sandboxId: string }): Promise<void> {
  await sandboxAdapter.destroy(input.sandboxId);
}

export async function verifyAgentOutput(input: {
  sandboxId: string;
  repoUrl: string;
  branchName?: string;
}): Promise<void> {
  if (!input.branchName) return;

  const diffResult = await sandboxAdapter.exec(input.sandboxId, `cd /workspace && git diff --stat origin/main...HEAD`);
  if (diffResult.isErr()) {
    throw new Error('Failed to verify agent output: ' + diffResult.error.message);
  }

  const logResult = await sandboxAdapter.exec(input.sandboxId, `cd /workspace && git log --oneline origin/main...HEAD`);
  if (logResult.isErr() || !logResult.value.stdout?.trim()) {
    throw new Error('No commits found on branch');
  }
}

export async function collectArtifacts(input: { sandboxId: string }): Promise<PublishedArtifact[]> {
  try {
    const result = await sandboxAdapter.exec(input.sandboxId, 'cat /workspace/.artifacts/manifest.json');
    if (result.isOk() && result.value.stdout) {
      return JSON.parse(result.value.stdout) as PublishedArtifact[];
    }
  } catch { /* no artifacts */ }
  return [];
}

export async function cleanupAndEscalate(input: {
  tenantId: string;
  workflowId: string;
  branchName?: string;
  repoUrl: string;
}): Promise<void> {
  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: input.workflowId,
    state: 'blocked_terminal',
  });
}
