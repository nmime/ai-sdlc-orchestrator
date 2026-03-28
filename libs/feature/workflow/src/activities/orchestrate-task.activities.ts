import { EntityManager } from '@mikro-orm/postgresql';
import {
  WorkflowMirror, WorkflowStatus, WorkflowEvent, Tenant, AgentSession, AgentMode,
  SessionStatus, TenantRepoConfig, WorkflowArtifact,
  ArtifactKind, ArtifactStatus, CostAlert, AlertType, StaticAnalysisResult,
} from '@app/db';
import type { AgentResult, AgentProvider, StaticAnalysisValue, SessionContext, PublishedArtifact, CostSettlement } from '@app/shared-type';
import type { SandboxPort } from '@app/feature-agent-registry';
import type { AgentProviderRegistry } from '@app/feature-agent-registry';
import type { PromptFormatter } from '@app/feature-agent-prompt';
import type { CredentialProxyClient } from '@app/feature-agent-credential-proxy';
import type { McpPolicyService } from '@app/feature-agent-mcp-policy';
import type { PromptSanitizer } from '@app/feature-agent-security';

let emFactory: () => EntityManager;
let sandboxAdapter: SandboxPort;
let agentRegistry: AgentProviderRegistry;
let promptFormatter: PromptFormatter;
let credentialProxy: CredentialProxyClient;
let mcpPolicyService: McpPolicyService;
let promptSanitizer: PromptSanitizer;

export function initActivities(deps: {
  em: EntityManager;
  sandboxAdapter: SandboxPort;
  agentRegistry: AgentProviderRegistry;
  promptFormatter: PromptFormatter;
  credentialProxy: CredentialProxyClient;
  mcpPolicyService?: McpPolicyService;
  promptSanitizer?: PromptSanitizer;
}) {
  emFactory = () => deps.em.fork();
  sandboxAdapter = deps.sandboxAdapter;
  agentRegistry = deps.agentRegistry;
  promptFormatter = deps.promptFormatter;
  credentialProxy = deps.credentialProxy;
  if (deps.mcpPolicyService) mcpPolicyService = deps.mcpPolicyService;
  if (deps.promptSanitizer) promptSanitizer = deps.promptSanitizer;
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
  fixAttemptCount?: number;
  reviewAttemptCount?: number;
  errorMessage?: string;
}): Promise<void> {
  const em = emFactory();
  let mirror = await em.findOne(WorkflowMirror, { temporalWorkflowId: input.temporalWorkflowId });

  if (!mirror) {
    mirror = new WorkflowMirror();
    mirror.tenant = em.getReference(Tenant, input.tenantId);
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
  if (input.mrUrl) {
    mirror.mrUrl = input.mrUrl;
    const mrIdMatch = input.mrUrl.match(/\/(?:merge_requests|pull)\/(\d+)/);  
    if (mrIdMatch) mirror.mrId = mrIdMatch[1];
  }
  if (input.costUsdTotal !== undefined) mirror.costUsdTotal = input.costUsdTotal;
  if (input.aiCostUsd !== undefined) mirror.aiCostUsd = input.aiCostUsd;
  if (input.sandboxCostUsd !== undefined) mirror.sandboxCostUsd = input.sandboxCostUsd;
  if (input.fixAttemptCount !== undefined) mirror.fixAttemptCount = input.fixAttemptCount;
  if (input.reviewAttemptCount !== undefined) mirror.reviewAttemptCount = input.reviewAttemptCount;
  if (input.errorMessage !== undefined) mirror.errorMessage = input.errorMessage;

  const event = new WorkflowEvent();
  event.workflow = mirror;
  event.eventType = 'state_transition';
  event.fromState = previousState;
  event.toState = input.state;
  event.aiCostUsd = input.aiCostUsd;
  event.sandboxCostUsd = input.sandboxCostUsd;
  event.totalCostUsd = input.costUsdTotal;
  em.persist(event);

  await em.flush();
}

export async function reserveBudget(input: {
  tenantId: string;
  estimatedCostUsd: number;
  repoId?: string;
}): Promise<void> {
  const em = emFactory();
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });

  if (input.repoId) {
    const repoConfig = await em.findOne(TenantRepoConfig, { tenant: input.tenantId, repoId: input.repoId });
    if (repoConfig && repoConfig.costLimitUsd > 0 && input.estimatedCostUsd > Number(repoConfig.costLimitUsd)) {
      throw new Error(`Per-task budget exceeded: $${input.estimatedCostUsd.toFixed(2)} > limit $${repoConfig.costLimitUsd}`);
    }
  }

  const totalAfter = Number(tenant.monthlyCostActualUsd) + Number(tenant.monthlyCostReservedUsd) + input.estimatedCostUsd;
  if (Number(tenant.monthlyCostLimitUsd) > 0 && totalAfter > Number(tenant.monthlyCostLimitUsd)) {
    throw new Error(`Tenant budget exceeded: $${totalAfter.toFixed(2)} > limit $${tenant.monthlyCostLimitUsd}`);
  }

  if (tenant.monthlyAiCostLimitUsd && Number(tenant.monthlyAiCostActualUsd) + input.estimatedCostUsd * 0.8 > Number(tenant.monthlyAiCostLimitUsd)) {
    throw new Error(`AI budget limit approaching: estimated AI cost would exceed $${tenant.monthlyAiCostLimitUsd}`);
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

  await checkCostAlerts(tenant, totalAfter);
}

async function checkCostAlerts(tenant: Tenant, currentTotal: number): Promise<void> {
  const em = emFactory();
  if (!tenant.costAlertThresholds?.length || Number(tenant.monthlyCostLimitUsd) <= 0) return;

  const pct = (currentTotal / Number(tenant.monthlyCostLimitUsd)) * 100;
  for (const threshold of tenant.costAlertThresholds) {
    if (pct >= threshold) {
      const existing = await em.findOne(CostAlert, {
        tenant: tenant.id,
        alertType: AlertType.TENANT_TOTAL,
        thresholdPct: threshold,
      });
      if (!existing) {
        const alert = new CostAlert();
        alert.tenant = tenant;
        alert.alertType = AlertType.TENANT_TOTAL;
        alert.thresholdPct = threshold;
        alert.actualUsd = currentTotal;
        alert.limitUsd = Number(tenant.monthlyCostLimitUsd);
        em.persist(alert);
      }
    }
  }
  await em.flush();
}

export async function settleCost(input: CostSettlement): Promise<void> {
  const em = emFactory();
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });

  await em.nativeUpdate(
    Tenant,
    { id: input.tenantId, budgetVersion: tenant.budgetVersion },
    {
      monthlyCostReservedUsd: Math.max(0, Number(tenant.monthlyCostReservedUsd) - input.reservedUsd),
      monthlyCostActualUsd: Number(tenant.monthlyCostActualUsd) + input.actualTotalCostUsd,
      monthlyAiCostActualUsd: Number(tenant.monthlyAiCostActualUsd) + input.actualAiCostUsd,
      monthlySandboxCostActualUsd: Number(tenant.monthlySandboxCostActualUsd) + input.actualSandboxCostUsd,
      budgetVersion: tenant.budgetVersion + 1,
    },
  );
}

export async function checkConcurrency(input: { tenantId: string; repoId: string }): Promise<void> {
  const em = emFactory();
  const repoConfig = await em.findOne(TenantRepoConfig, { tenant: input.tenantId, repoId: input.repoId });
  const maxConcurrent = repoConfig?.maxConcurrentWorkflows ?? 1;

  const activeCount = await em.count(WorkflowMirror, {
    tenant: input.tenantId,
    repoId: input.repoId,
    state: { $in: [
      WorkflowStatus.IMPLEMENTING, WorkflowStatus.CI_WATCH, WorkflowStatus.CI_FIXING,
      WorkflowStatus.IN_REVIEW, WorkflowStatus.REVIEW_FIXING,
    ] },
  });

  if (activeCount >= maxConcurrent) {
    throw new Error(`Concurrency limit reached: ${activeCount}/${maxConcurrent} active workflows for repo ${input.repoId}`);
  }
}

export async function checkAdmission(input: { tenantId: string }): Promise<void> {
  const em = emFactory();
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });

  const activeSandboxCount = await em.count(AgentSession, {
    workflow: { tenant: input.tenantId },
    status: SessionStatus.RUNNING,
  });

  if (activeSandboxCount >= tenant.maxConcurrentSandboxes) {
    throw new Error(`Sandbox admission denied: ${activeSandboxCount}/${tenant.maxConcurrentSandboxes} sandboxes active`);
  }
}

export async function createSandbox(input: {
  tenantId: string;
  repoUrl: string;
  sessionToken?: string;
  cloneStrategy?: string;
  sparseCheckoutPaths?: string[];
  env?: Record<string, string>;
}): Promise<{ sandboxId: string }> {
  const _em = emFactory();
  const sandboxEnv: Record<string, string> = {
    REPO_URL: input.repoUrl,
    ...input.env,
  };
  if (input.sessionToken) {
    sandboxEnv['SESSION_TOKEN'] = input.sessionToken;
    sandboxEnv['CREDENTIAL_PROXY_URL'] = process.env['CREDENTIAL_PROXY_URL'] || 'http://localhost:4000';
  }

  const URL_PATTERN = /^https?:\/\/[a-zA-Z0-9._:/-]+$/;
  if (!URL_PATTERN.test(input.repoUrl)) {
    throw new Error(`Invalid repository URL: ${input.repoUrl}`);
  }

  if (input.cloneStrategy === 'sparse' && input.sparseCheckoutPaths?.length) {
    const PATH_PATTERN = /^[a-zA-Z0-9._/-]+$/;
    if (!input.sparseCheckoutPaths.every(p => PATH_PATTERN.test(p))) {
      throw new Error('Invalid characters in sparse checkout paths');
    }
  }

  const result = await sandboxAdapter.create({
    timeoutMs: 600_000,
    env: sandboxEnv,
  });

  if (result.isErr()) throw new Error(result.error.message);

  const { sandboxId } = result.value;

  const SAFE_REPO_URL = /^(https:\/\/[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}\/|git@[a-zA-Z0-9._-]+:)/;
  if (!SAFE_REPO_URL.test(input.repoUrl)) {
    throw new Error('Invalid repository URL scheme');
  }

  let cloneCmd = `git clone -- '${input.repoUrl.replace(/'/g, "'\\''")}' /workspace`;
  if (input.cloneStrategy === 'shallow') {
    cloneCmd = `git clone --depth=1 --shallow-since="30 days ago" -- '${input.repoUrl.replace(/'/g, "'\\''")}' /workspace`;
  } else if (input.cloneStrategy === 'sparse' && input.sparseCheckoutPaths?.length) {
    const safePaths = input.sparseCheckoutPaths;
    cloneCmd = [
      `git clone --filter=blob:none --sparse -- '${input.repoUrl.replace(/'/g, "'\\''")}' /workspace`,
      `cd /workspace`,
      `git sparse-checkout set ${safePaths.map(p => `'${p.replace(/'/g, "'\\''")}'`).join(' ')}`,
    ].join(' && ');
  }

  const cloneResult = await sandboxAdapter.exec(sandboxId, cloneCmd);
  if (cloneResult.isErr()) {
    await sandboxAdapter.destroy(sandboxId);
    throw new Error(`Clone failed: ${cloneResult.error.message}`);
  }

  return { sandboxId };
}

export async function pauseSandbox(input: { sandboxId: string }): Promise<void> {
  await sandboxAdapter.pause(input.sandboxId);
}

export async function resumeSandbox(input: { sandboxId: string }): Promise<{ sandboxId: string }> {
  const result = await sandboxAdapter.resume(input.sandboxId);
  if (result.isErr()) return { sandboxId: input.sandboxId };
  return { sandboxId: result.value.sandboxId };
}

export async function invokeAgent(input: {
  tenantId: string;
  temporalWorkflowId: string;
  sandboxId: string;
  mode: 'implement' | 'ci_fix' | 'review_fix';
  repoUrl: string;
  repoId: string;
  loopIteration?: number;
  previousContext?: SessionContext;
  taskLabel?: string;
}): Promise<AgentResult> {
  const em = emFactory();
  const tenant = await em.findOneOrFail(Tenant, { id: input.tenantId });
  const repoConfig = await em.findOne(TenantRepoConfig, { tenant: input.tenantId, repoId: input.repoId });
  const mirror = await em.findOne(WorkflowMirror, { temporalWorkflowId: input.temporalWorkflowId });

  const resolved = agentRegistry.resolveProvider({
    repoAgentProvider: repoConfig?.agentProvider ?? undefined,
    repoAgentModel: repoConfig?.agentModel ?? undefined,
    repoModelRouting: repoConfig?.modelRouting ?? undefined,
    tenantDefaultProvider: tenant.defaultAgentProvider ?? undefined,
    tenantDefaultModel: tenant.defaultAgentModel ?? undefined,
    taskLabel: input.taskLabel,
  });

  const mcpServers = mcpPolicyService
    ? await mcpPolicyService.filterServers(input.tenantId, tenant.mcpServerPolicy)
    : [];

  let taskSeed = `Mode: ${input.mode}`;
  if (promptSanitizer) {
    const sanitized = promptSanitizer.sanitizeInput(taskSeed);
    taskSeed = sanitized.sanitized;
  }

  const prompt = promptFormatter.format(resolved.providerName, {
    taskSeed,
    repoInfo: {
      url: input.repoUrl,
      branch: mirror?.branchName || 'main',
      defaultBranch: 'main',
      paths: repoConfig?.allowedPaths ?? undefined,
    },
    workflowInstructions: {
      qualityGates: repoConfig?.qualityGateCommands ?? ['test', 'lint'],
      maxDiffLines: repoConfig?.maxDiffLines ?? undefined,
      commitMessagePattern: repoConfig?.commitMessagePattern ?? undefined,
      mrDescriptionTemplate: repoConfig?.mrDescriptionTemplate ?? undefined,
      staticAnalysisCommand: repoConfig?.staticAnalysisCommand ?? undefined,
    },
    mcpServers,
    previousContext: input.previousContext,
  });

  const modeMap: Record<string, AgentMode> = {
    implement: AgentMode.IMPLEMENT,
    ci_fix: AgentMode.CI_FIX,
    review_fix: AgentMode.REVIEW_FIX,
  };

  const session = new AgentSession();
  session.workflow = mirror ?? em.getReference(WorkflowMirror, input.temporalWorkflowId);
  session.provider = resolved.providerName;
  session.mode = modeMap[input.mode] || AgentMode.IMPLEMENT;
  session.loopIteration = input.loopIteration ?? 0;
  session.model = resolved.model;
  session.promptSent = prompt;
  em.persist(session);
  await em.flush();

  const sessionToken = await createSessionToken(input.tenantId, input.temporalWorkflowId, session.id);

  const costLimit = repoConfig?.costLimitUsd ?? 5;
  const result = await resolved.provider.invoke({
    sessionId: session.id,
    provider: resolved.providerName,
    prompt,
    sandboxId: input.sandboxId,
    maxDurationMs: 3_600_000,
    maxCostUsd: costLimit,
    credentialProxyUrl: process.env['CREDENTIAL_PROXY_URL'] || 'http://localhost:4000',
    previousContext: input.previousContext,
  });

  if (sessionToken) {
    await credentialProxy.revokeSession(sessionToken);
  }

  const failureResult = (msg: string, errorCode?: string): AgentResult => ({
    sessionId: session.id,
    provider: resolved.providerName as AgentProvider,
    model: resolved.model,
    status: 'failure',
    errorCode,
    errorMessage: msg,
    summary: '',
    cost: { ai: { inputTokens: 0, outputTokens: 0, usd: 0, provider: resolved.providerName as AgentProvider, model: resolved.model }, sandbox: { durationSeconds: 0, usd: 0 }, totalUsd: 0 },
    turnCount: 0,
    toolCalls: [],
  });

  if (result.isErr()) {
    session.status = SessionStatus.FAILED;
    session.completedAt = new Date();
    await em.flush();
    return failureResult(result.error.message, result.error.code);
  }

  const output = result.value;

  session.status = output.success ? SessionStatus.COMPLETED : SessionStatus.FAILED;
  session.inputTokens = output.inputTokens;
  session.outputTokens = output.outputTokens;
  session.aiCostUsd = output.aiCostUsd;
  session.sandboxCostUsd = output.sandboxCostUsd;
  session.totalCostUsd = output.aiCostUsd + output.sandboxCostUsd;
  session.agentSummary = `Agent completed with ${output.filesChanged} files changed`;
  session.completedAt = new Date();

  const diffResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git diff --stat HEAD~1 HEAD 2>/dev/null || echo "no diff"');
  if (diffResult.isOk()) {
    const lines = diffResult.value.stdout.split('\n').filter(Boolean);
    session.diffLinesChanged = lines.length;
    session.filesModified = lines.filter(l => l.includes('|')).map(l => l.split('|')[0]?.trim() ?? '');
  }

  if (repoConfig?.staticAnalysisCommand) {
    const SAFE_CMD_PREFIXES = ['npm run', 'npx eslint', 'npx prettier', 'yarn lint', 'yarn run', 'pnpm lint', 'pnpm run'];
    const cmdStr = repoConfig.staticAnalysisCommand.trim();
    if (!SAFE_CMD_PREFIXES.some(prefix => cmdStr.startsWith(prefix))) {
      session.staticAnalysisResult = StaticAnalysisResult.FAILED;
      session.staticAnalysisOutput = 'Blocked: command does not match allowed prefixes';
    } else {
      const saResult = await sandboxAdapter.exec(input.sandboxId, `cd /workspace && ${cmdStr}`);
      if (saResult.isOk()) {
        session.staticAnalysisResult = saResult.value.exitCode === 0 ? StaticAnalysisResult.PASSED : StaticAnalysisResult.FAILED;
        session.staticAnalysisOutput = (saResult.value.stdout + saResult.value.stderr).slice(0, 5000);
      }
    }
  }

  session.qualityScore = calculateQualityScore(session, output);

  if (promptSanitizer) {
    const scan = promptSanitizer.scanOutput(session.agentSummary || '');
    if (!scan.clean) {
      session.result = { securityFindings: scan.findings };
    }
  }

  await em.flush();

  const agentResult: AgentResult = {
    sessionId: session.id,
    provider: resolved.providerName as AgentProvider,
    model: resolved.model,
    status: output.success ? 'success' : 'failure',
    errorMessage: output.errorMessage,
    summary: `Agent completed with ${output.filesChanged} files changed`,
    artifacts: output.artifacts,
    cost: {
      ai: { inputTokens: output.inputTokens, outputTokens: output.outputTokens, usd: output.aiCostUsd, provider: resolved.providerName as AgentProvider, model: resolved.model },
      sandbox: { durationSeconds: 0, usd: output.sandboxCostUsd },
      totalUsd: output.aiCostUsd + output.sandboxCostUsd,
    },
    turnCount: 1,
    toolCalls: [],
    diffStats: {
      linesAdded: session.diffLinesChanged ?? 0,
      linesRemoved: 0,
      filesChanged: session.filesModified ?? [],
    },
    staticAnalysisResult: session.staticAnalysisResult as StaticAnalysisValue | undefined,
    staticAnalysisOutput: session.staticAnalysisOutput,
  };

  return agentResult;
}

async function createSessionToken(tenantId: string, _workflowId: string, _sessionId: string): Promise<string | null> {
  try {
    const result = await credentialProxy.createSession(tenantId, ['git', 'mcp', 'ai-api']);
    if (result.isOk()) return result.value.token;
  } catch { /* credential proxy optional */ }
  return null;
}

function calculateQualityScore(session: AgentSession, output: { success: boolean; filesChanged: number }): number {
  let score = 0;
  let factors = 0;

  if (output.success) { score += 1; factors++; }
  else { score += 0; factors++; }

  if (output.filesChanged > 0 && output.filesChanged < 50) { score += 1; factors++; }
  else if (output.filesChanged >= 50) { score += 0.3; factors++; }
  else { score += 0; factors++; }

  if (session.staticAnalysisResult === StaticAnalysisResult.PASSED) { score += 1; factors++; }
  else if (session.staticAnalysisResult === StaticAnalysisResult.FAILED) { score += 0; factors++; }

  if (session.diffLinesChanged && session.diffLinesChanged < 500) { score += 1; factors++; }
  else if (session.diffLinesChanged && session.diffLinesChanged >= 500) { score += 0.5; factors++; }

  return factors > 0 ? Number((score / factors).toFixed(2)) : 0;
}

export async function destroySandbox(input: { sandboxId: string }): Promise<void> {
  try {
    const logResult = await sandboxAdapter.exec(input.sandboxId, 'cat /tmp/agent.log 2>/dev/null | tail -100');
    if (logResult.isOk() && logResult.value.stdout) {
      /* logs collected before destroy for observability */
    }
  } catch { /* best effort */ }
  await sandboxAdapter.destroy(input.sandboxId);
}

export async function verifyAgentOutput(input: {
  sandboxId: string;
  repoUrl: string;
  branchName?: string;
  maxDiffLines?: number;
  allowedPaths?: string[];
}): Promise<void> {
  const _em = emFactory();
  if (!input.branchName) return;

  const diffResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git diff --stat origin/main...HEAD');
  if (diffResult.isErr()) throw new Error('Failed to verify agent output: ' + diffResult.error.message);

  const logResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git log --oneline origin/main...HEAD');
  if (logResult.isErr() || !logResult.value.stdout?.trim()) {
    throw new Error('No commits found on branch');
  }

  if (input.maxDiffLines) {
    const numstatResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git diff --numstat origin/main...HEAD');
    if (numstatResult.isOk()) {
      const totalLines = numstatResult.value.stdout.split('\n')
        .filter(Boolean)
        .reduce((sum, line) => {
          const parts = line.split('\t');
          return sum + (parseInt(parts[0] ?? '0') || 0) + (parseInt(parts[1] ?? '0') || 0);
        }, 0);

      if (totalLines > input.maxDiffLines) {
        throw new Error(`Diff too large: ${totalLines} lines > max ${input.maxDiffLines}`);
      }
    }
  }

  if (input.allowedPaths?.length) {
    const filesResult = await sandboxAdapter.exec(input.sandboxId, 'cd /workspace && git diff --name-only origin/main...HEAD');
    if (filesResult.isOk()) {
      const files = filesResult.value.stdout.split('\n').filter(Boolean);
      for (const file of files) {
        if (!input.allowedPaths.some(p => file.startsWith(p))) {
          throw new Error(`File '${file}' outside allowed paths: ${input.allowedPaths.join(', ')}`);
        }
      }
    }
  }
}

export async function collectArtifacts(input: {
  sandboxId: string;
  tenantId: string;
  temporalWorkflowId: string;
}): Promise<PublishedArtifact[]> {
  const em = emFactory();
  try {
    const result = await sandboxAdapter.exec(input.sandboxId, 'cat /workspace/.artifacts/manifest.json');
    if (result.isOk() && result.value.stdout) {
      const artifacts = JSON.parse(result.value.stdout) as PublishedArtifact[];

      const mirror = await em.findOne(WorkflowMirror, { temporalWorkflowId: input.temporalWorkflowId });
      if (mirror) {
        for (const artifact of artifacts) {
          const entity = new WorkflowArtifact();
          entity.workflow = mirror;
          entity.tenant = em.getReference(Tenant, input.tenantId);
          entity.kind = (artifact.kind as ArtifactKind) || ArtifactKind.OTHER;
          entity.title = artifact.title;
          entity.uri = artifact.uri;
          entity.mimeType = artifact.mimeType;
          entity.previewUrl = artifact.previewUrl;
          entity.metadata = artifact.metadata;
          entity.content = artifact.content;
          entity.status = artifact.status === 'published' ? ArtifactStatus.PUBLISHED : ArtifactStatus.DRAFT;
          em.persist(entity);
        }
        await em.flush();
      }

      return artifacts;
    }
  } catch { /* no artifacts */ }
  return [];
}

export async function cleanupAndEscalate(input: {
  tenantId: string;
  workflowId: string;
  branchName?: string;
  repoUrl: string;
  errorMessage?: string;
}): Promise<void> {
  const _em = emFactory();
  await updateWorkflowMirror({
    tenantId: input.tenantId,
    temporalWorkflowId: input.workflowId,
    state: 'blocked_terminal',
    errorMessage: input.errorMessage,
  });
}
