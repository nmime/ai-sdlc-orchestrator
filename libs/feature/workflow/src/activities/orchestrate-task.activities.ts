import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowMirror, WorkflowStatus, WorkflowEvent, Tenant } from '@ai-sdlc/db';
import type { AgentInvokeOutput } from '@ai-sdlc/shared-type';

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
  status: string;
  taskExternalId?: string;
  taskTitle?: string;
  taskDescription?: string;
  repoUrl?: string;
  totalCostUsd?: number;
  mrUrl?: string;
}): Promise<void> {
  let mirror = await em.findOne(WorkflowMirror, { temporalWorkflowId: input.temporalWorkflowId });

  if (!mirror) {
    mirror = new WorkflowMirror();
    mirror.tenant = em.getReference(Tenant, input.tenantId) as any;
    mirror.temporalWorkflowId = input.temporalWorkflowId;
    mirror.temporalRunId = '';
    mirror.taskExternalId = input.taskExternalId || '';
    mirror.taskTitle = input.taskTitle || '';
    mirror.taskDescription = input.taskDescription;
    mirror.repoUrl = input.repoUrl || '';
    em.persist(mirror);
  }

  const previousStatus = mirror.status;
  mirror.status = input.status as WorkflowStatus;

  if (input.totalCostUsd !== undefined) mirror.totalCostUsd = input.totalCostUsd;
  if (input.mrUrl !== undefined) mirror.mrUrl = input.mrUrl;

  if (input.status === 'completed' || input.status === 'failed') {
    mirror.completedAt = new Date();
  }

  const event = new WorkflowEvent();
  event.workflow = mirror;
  event.fromStatus = previousStatus;
  event.toStatus = input.status as WorkflowStatus;
  em.persist(event);

  await em.flush();
}

export async function reserveBudget(input: { tenantId: string; amountUsd: number }): Promise<void> {
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });

  if (tenant.budgetLimitUsd > 0 && tenant.budgetUsedUsd + input.amountUsd > tenant.budgetLimitUsd) {
    throw new Error(`Budget exceeded: $${tenant.budgetUsedUsd} + $${input.amountUsd} > $${tenant.budgetLimitUsd}`);
  }

  const updated = await em.nativeUpdate(
    Tenant,
    { id: input.tenantId, budgetVersion: tenant.budgetVersion },
    {
      budgetUsedUsd: tenant.budgetUsedUsd + input.amountUsd,
      budgetVersion: tenant.budgetVersion + 1,
    },
  );

  if (updated === 0) {
    throw new Error('Budget concurrency conflict, retry');
  }
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

  const cloneResult = await sandboxAdapter.exec(sandboxId, `git clone ${input.repoUrl} /workspace && cd /workspace`);
  if (cloneResult.isErr()) {
    throw new Error(`Clone failed: ${cloneResult.error.message}`);
  }

  return { sandboxId };
}

export async function invokeAgent(input: {
  tenantId: string;
  sandboxId: string;
  taskTitle: string;
  taskDescription: string;
  repoUrl: string;
  previousFeedback?: string;
}): Promise<AgentInvokeOutput> {
  const prompt = promptFormatter.format('claude_code', {
    taskId: input.tenantId,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    repoUrl: input.repoUrl,
    branch: 'main',
    previousAttemptFeedback: input.previousFeedback,
  });

  const agent = agentRegistry.getOrThrow('claude_code');
  const result = await agent.invoke({
    sessionId: `${input.tenantId}-${Date.now()}`,
    provider: 'claude_code',
    prompt,
    sandboxId: input.sandboxId,
    maxDurationMs: 1800_000,
    maxCostUsd: 50,
    credentialProxyUrl: credentialProxy.baseUrl,
  });

  if (result.isErr()) {
    throw new Error(result.error.message);
  }

  return result.value;
}

export async function destroySandbox(input: { sandboxId: string }): Promise<void> {
  const result = await sandboxAdapter.destroy(input.sandboxId);
  if (result.isErr()) {
    throw new Error(result.error.message);
  }
}

export async function verifyAgentOutput(input: {
  sandboxId: string;
  repoUrl: string;
}): Promise<void> {
  const diffResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git diff --stat HEAD');
  if (diffResult.isErr()) throw new Error('Cannot verify output');

  if (!diffResult.value.stdout.trim()) {
    throw new Error('No changes detected in workspace');
  }

  const statusResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git log --oneline -1');
  if (statusResult.isErr()) throw new Error('Cannot verify commits');
}

export async function collectArtifacts(input: {
  sandboxId: string;
}): Promise<{ type: string; name: string; url: string }[]> {
  const result = await sandboxAdapter.exec(input.sandboxId, 'ls /workspace/.artifacts/ 2>/dev/null || echo ""');
  if (result.isErr() || !result.value.stdout.trim()) return [];

  const files = result.value.stdout.trim().split('\n').filter(Boolean);
  return files.map((f: string) => ({
    type: 'other',
    name: f,
    url: `/workspace/.artifacts/${f}`,
  }));
}

export async function recordCost(input: {
  tenantId: string;
  totalCostUsd: number;
}): Promise<void> {
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });
  tenant.budgetUsedUsd = Number(tenant.budgetUsedUsd) + input.totalCostUsd;
  await em.flush();
}
