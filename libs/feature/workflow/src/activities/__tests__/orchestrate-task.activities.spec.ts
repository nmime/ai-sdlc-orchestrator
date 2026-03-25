import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEm, createMockSandboxAdapter, createMockAgentRegistry, createMockPromptFormatter, createMockCredentialProxy, createMockMcpPolicyService, createMockPromptSanitizer } from '@ai-sdlc/common/__tests__/test-utils';
import {
  initActivities,
  updateWorkflowMirror,
  reserveBudget,
  settleCost,
  checkConcurrency,
  checkAdmission,
  createSandbox,
  pauseSandbox,
  resumeSandbox,
  invokeAgent,
  destroySandbox,
  verifyAgentOutput,
  collectArtifacts,
  cleanupAndEscalate,
} from '../orchestrate-task.activities';

let mockEm: ReturnType<typeof createMockEm>;
let mockSandbox: ReturnType<typeof createMockSandboxAdapter>;
let mockRegistry: ReturnType<typeof createMockAgentRegistry>;
let mockFormatter: ReturnType<typeof createMockPromptFormatter>;
let mockCredProxy: ReturnType<typeof createMockCredentialProxy>;
let mockMcpPolicy: ReturnType<typeof createMockMcpPolicyService>;
let mockSanitizer: ReturnType<typeof createMockPromptSanitizer>;

beforeEach(() => {
  mockEm = createMockEm();
  mockSandbox = createMockSandboxAdapter();
  mockRegistry = createMockAgentRegistry();
  mockFormatter = createMockPromptFormatter();
  mockCredProxy = createMockCredentialProxy();
  mockMcpPolicy = createMockMcpPolicyService();
  mockSanitizer = createMockPromptSanitizer();

  initActivities({
    em: mockEm as any,
    sandboxAdapter: mockSandbox as any,
    agentRegistry: mockRegistry as any,
    promptFormatter: mockFormatter as any,
    credentialProxy: mockCredProxy as any,
    mcpPolicyService: mockMcpPolicy as any,
    promptSanitizer: mockSanitizer as any,
  });
});

describe('updateWorkflowMirror', () => {
  it('creates a new mirror if none exists', async () => {
    mockEm.findOne.mockResolvedValue(null);
    await updateWorkflowMirror({
      tenantId: 't-1', temporalWorkflowId: 'wf-1', state: 'implementing',
      taskId: 'TASK-1', repoId: 'repo-1', repoUrl: 'https://github.com/test/repo',
    });
    expect(mockEm.persist).toHaveBeenCalledTimes(2);
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it('updates existing mirror fields', async () => {
    const existing = {
      temporalWorkflowId: 'wf-1', state: 'queued', currentStepId: undefined,
      branchName: undefined, mrUrl: undefined, costUsdTotal: 0, aiCostUsd: 0,
      sandboxCostUsd: 0, fixAttemptCount: 0, reviewAttemptCount: 0, errorMessage: undefined,
    };
    mockEm.findOne.mockResolvedValue(existing);
    await updateWorkflowMirror({
      tenantId: 't-1', temporalWorkflowId: 'wf-1', state: 'implementing',
      currentStepId: 'step-1', branchName: 'ai/task-1', costUsdTotal: 1.5,
    });
    expect(existing.state).toBe('implementing');
    expect(existing.currentStepId).toBe('step-1');
    expect(existing.branchName).toBe('ai/task-1');
    expect(existing.costUsdTotal).toBe(1.5);
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it('creates a WorkflowEvent with state transition', async () => {
    mockEm.findOne.mockResolvedValue({ state: 'queued', temporalWorkflowId: 'wf-1' });
    await updateWorkflowMirror({
      tenantId: 't-1', temporalWorkflowId: 'wf-1', state: 'implementing', aiCostUsd: 0.5,
    });
    const persistedEvent = mockEm.persist.mock.calls[0][0];
    expect(persistedEvent.eventType).toBe('state_transition');
    expect(persistedEvent.fromState).toBe('queued');
    expect(persistedEvent.toState).toBe('implementing');
  });
});

describe('reserveBudget', () => {
  it('reserves budget successfully', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 10, monthlyCostReservedUsd: 5,
      monthlyCostLimitUsd: 100, monthlyAiCostActualUsd: 5, monthlyAiCostLimitUsd: 0,
      budgetVersion: 1, costAlertThresholds: [],
    });
    mockEm.findOne.mockResolvedValue(null);
    await reserveBudget({ tenantId: 't-1', estimatedCostUsd: 2 });
    expect(mockEm.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { id: 't-1', budgetVersion: 1 },
      expect.objectContaining({ monthlyCostReservedUsd: 7, budgetVersion: 2 }),
    );
  });

  it('throws when tenant budget exceeded', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 90, monthlyCostReservedUsd: 5,
      monthlyCostLimitUsd: 100, budgetVersion: 1, costAlertThresholds: [],
    });
    mockEm.findOne.mockResolvedValue(null);
    await expect(reserveBudget({ tenantId: 't-1', estimatedCostUsd: 10 }))
      .rejects.toThrow('Tenant budget exceeded');
  });

  it('throws when per-task repo budget exceeded', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 0, monthlyCostReservedUsd: 0,
      monthlyCostLimitUsd: 1000, budgetVersion: 1, costAlertThresholds: [],
    });
    mockEm.findOne.mockResolvedValue({ costLimitUsd: 5 });
    await expect(reserveBudget({ tenantId: 't-1', estimatedCostUsd: 10, repoId: 'repo-1' }))
      .rejects.toThrow('Per-task budget exceeded');
  });

  it('throws when AI budget limit approaching', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 0, monthlyCostReservedUsd: 0,
      monthlyCostLimitUsd: 1000, monthlyAiCostActualUsd: 90, monthlyAiCostLimitUsd: 100,
      budgetVersion: 1, costAlertThresholds: [],
    });
    mockEm.findOne.mockResolvedValue(null);
    await expect(reserveBudget({ tenantId: 't-1', estimatedCostUsd: 20 }))
      .rejects.toThrow('AI budget limit approaching');
  });

  it('throws on optimistic locking conflict', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 0, monthlyCostReservedUsd: 0,
      monthlyCostLimitUsd: 1000, budgetVersion: 1, costAlertThresholds: [],
    });
    mockEm.findOne.mockResolvedValue(null);
    mockEm.nativeUpdate.mockResolvedValue(0);
    await expect(reserveBudget({ tenantId: 't-1', estimatedCostUsd: 2 }))
      .rejects.toThrow('Budget concurrency conflict');
  });

  it('creates cost alert when threshold crossed', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostActualUsd: 70, monthlyCostReservedUsd: 5,
      monthlyCostLimitUsd: 100, budgetVersion: 1,
      costAlertThresholds: [50, 80],
    });
    mockEm.findOne.mockResolvedValue(null);
    await reserveBudget({ tenantId: 't-1', estimatedCostUsd: 5 });
    expect(mockEm.persist).toHaveBeenCalled();
  });
});

describe('settleCost', () => {
  it('releases reserved and adds actual costs', async () => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', monthlyCostReservedUsd: 10, monthlyCostActualUsd: 5,
      monthlyAiCostActualUsd: 3, monthlySandboxCostActualUsd: 2, budgetVersion: 3,
    });
    await settleCost({
      tenantId: 't-1', workflowId: 'wf-1', reservedUsd: 5, actualTotalCostUsd: 4,
      actualAiCostUsd: 3, actualSandboxCostUsd: 1,
    });
    expect(mockEm.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { id: 't-1', budgetVersion: 3 },
      expect.objectContaining({
        monthlyCostReservedUsd: 5,
        monthlyCostActualUsd: 9,
        monthlyAiCostActualUsd: 6,
        monthlySandboxCostActualUsd: 3,
        budgetVersion: 4,
      }),
    );
  });
});

describe('checkConcurrency', () => {
  it('passes when below limit', async () => {
    mockEm.findOne.mockResolvedValue({ maxConcurrentWorkflows: 3 });
    mockEm.count.mockResolvedValue(2);
    await expect(checkConcurrency({ tenantId: 't-1', repoId: 'repo-1' })).resolves.toBeUndefined();
  });

  it('throws when at limit', async () => {
    mockEm.findOne.mockResolvedValue({ maxConcurrentWorkflows: 2 });
    mockEm.count.mockResolvedValue(2);
    await expect(checkConcurrency({ tenantId: 't-1', repoId: 'repo-1' }))
      .rejects.toThrow('Concurrency limit reached');
  });

  it('defaults to 1 when no repo config', async () => {
    mockEm.findOne.mockResolvedValue(null);
    mockEm.count.mockResolvedValue(1);
    await expect(checkConcurrency({ tenantId: 't-1', repoId: 'repo-1' }))
      .rejects.toThrow('Concurrency limit reached');
  });
});

describe('checkAdmission', () => {
  it('passes when below sandbox limit', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ maxConcurrentSandboxes: 5 });
    mockEm.count.mockResolvedValue(3);
    await expect(checkAdmission({ tenantId: 't-1' })).resolves.toBeUndefined();
  });

  it('throws when at sandbox limit', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ maxConcurrentSandboxes: 3 });
    mockEm.count.mockResolvedValue(3);
    await expect(checkAdmission({ tenantId: 't-1' }))
      .rejects.toThrow('Sandbox admission denied');
  });
});

describe('createSandbox', () => {
  it('creates sandbox and clones repo', async () => {
    const result = await createSandbox({ tenantId: 't-1', repoUrl: 'https://github.com/test/repo' });
    expect(result).toEqual({ sandboxId: 'sb-1' });
    expect(mockSandbox.create).toHaveBeenCalled();
    expect(mockSandbox.exec).toHaveBeenCalled();
  });

  it('uses shallow clone strategy', async () => {
    await createSandbox({ tenantId: 't-1', repoUrl: 'https://github.com/test/repo', cloneStrategy: 'shallow' });
    const execArgs = mockSandbox.exec.mock.calls[0];
    expect(execArgs[1]).toContain('--depth=1');
  });

  it('uses sparse clone strategy', async () => {
    await createSandbox({
      tenantId: 't-1', repoUrl: 'https://github.com/test/repo',
      cloneStrategy: 'sparse', sparseCheckoutPaths: ['src/', 'tests/'],
    });
    const execArgs = mockSandbox.exec.mock.calls[0];
    expect(execArgs[1]).toContain('--sparse');
    expect(execArgs[1]).toContain('src/ tests/');
  });

  it('destroys sandbox on clone failure', async () => {
    mockSandbox.exec.mockResolvedValue({ isErr: () => true, isOk: () => false, error: { message: 'clone fail' } });
    await expect(createSandbox({ tenantId: 't-1', repoUrl: 'https://github.com/test/repo' }))
      .rejects.toThrow('Clone failed');
    expect(mockSandbox.destroy).toHaveBeenCalledWith('sb-1');
  });

  it('throws on sandbox creation failure', async () => {
    mockSandbox.create.mockResolvedValue({ isErr: () => true, isOk: () => false, error: { message: 'no capacity' } });
    await expect(createSandbox({ tenantId: 't-1', repoUrl: 'https://github.com/test/repo' }))
      .rejects.toThrow('no capacity');
  });

  it('passes session token and env vars', async () => {
    await createSandbox({ tenantId: 't-1', repoUrl: 'https://github.com/test/repo', sessionToken: 'tok-1', env: { FOO: 'bar' } });
    const createArgs = mockSandbox.create.mock.calls[0][0];
    expect(createArgs.env.SESSION_TOKEN).toBe('tok-1');
    expect(createArgs.env.FOO).toBe('bar');
    expect(createArgs.env.REPO_URL).toBe('https://github.com/test/repo');
  });
});

describe('pauseSandbox / destroySandbox', () => {
  it('pauses sandbox', async () => {
    await pauseSandbox({ sandboxId: 'sb-1' });
    expect(mockSandbox.pause).toHaveBeenCalledWith('sb-1');
  });

  it('destroys sandbox after collecting logs', async () => {
    await destroySandbox({ sandboxId: 'sb-1' });
    expect(mockSandbox.destroy).toHaveBeenCalledWith('sb-1');
  });
});

describe('resumeSandbox', () => {
  it('returns new sandboxId on success', async () => {
    mockSandbox.resume.mockResolvedValue({ isErr: () => false, isOk: () => true, value: { sandboxId: 'sb-new' } });
    const result = await resumeSandbox({ sandboxId: 'sb-1' });
    expect(result).toEqual({ sandboxId: 'sb-new' });
  });

  it('returns original sandboxId on failure', async () => {
    mockSandbox.resume.mockResolvedValue({ isErr: () => true, isOk: () => false, error: { message: 'fail' } });
    const result = await resumeSandbox({ sandboxId: 'sb-1' });
    expect(result).toEqual({ sandboxId: 'sb-1' });
  });
});

describe('verifyAgentOutput', () => {
  it('skips verification when no branch name', async () => {
    await verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'url' });
    expect(mockSandbox.exec).not.toHaveBeenCalled();
  });

  it('throws when diff check fails', async () => {
    mockSandbox.exec.mockResolvedValueOnce({ isErr: () => true, isOk: () => false, error: { message: 'fail' } });
    await expect(verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task' }))
      .rejects.toThrow('Failed to verify agent output');
  });

  it('throws when no commits found', async () => {
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: '1 file changed', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => true, isOk: () => false, error: { message: 'fail' } });
    await expect(verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task' }))
      .rejects.toThrow('No commits found');
  });

  it('throws when log output is empty', async () => {
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'stat', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: '', stderr: '', exitCode: 0 } });
    await expect(verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task' }))
      .rejects.toThrow('No commits found');
  });

  it('throws when diff too large', async () => {
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'stat', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'abc123 commit msg', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: '500\t500\tfile.ts', stderr: '', exitCode: 0 } });
    await expect(verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task', maxDiffLines: 100 }))
      .rejects.toThrow('Diff too large');
  });

  it('throws when file outside allowed paths', async () => {
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'stat', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'abc commit', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'hack/evil.ts', stderr: '', exitCode: 0 } });
    await expect(verifyAgentOutput({
      sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task', allowedPaths: ['src/'],
    })).rejects.toThrow('outside allowed paths');
  });

  it('passes when all files within allowed paths', async () => {
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'stat', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'abc commit', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'src/index.ts', stderr: '', exitCode: 0 } });
    await expect(verifyAgentOutput({
      sandboxId: 'sb-1', repoUrl: 'url', branchName: 'ai/task', allowedPaths: ['src/'],
    })).resolves.toBeUndefined();
  });
});

describe('collectArtifacts', () => {
  it('parses manifest and creates artifact entities', async () => {
    const manifest = JSON.stringify([
      { kind: 'merge_request', title: 'MR #1', uri: 'https://gitlab.com/mr/1', status: 'published' },
      { kind: 'report', title: 'Test Report', uri: '/artifacts/report.html', status: 'draft' },
    ]);
    mockSandbox.exec.mockResolvedValue({ isErr: () => false, isOk: () => true, value: { stdout: manifest, stderr: '', exitCode: 0 } });
    mockEm.findOne.mockResolvedValue({ id: 'mirror-1' });
    const result = await collectArtifacts({ sandboxId: 'sb-1', tenantId: 't-1', temporalWorkflowId: 'wf-1' });
    expect(result).toHaveLength(2);
    expect(mockEm.persist).toHaveBeenCalledTimes(2);
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it('returns empty array when no manifest found', async () => {
    mockSandbox.exec.mockResolvedValue({ isErr: () => true, isOk: () => false, error: { message: 'not found' } });
    const result = await collectArtifacts({ sandboxId: 'sb-1', tenantId: 't-1', temporalWorkflowId: 'wf-1' });
    expect(result).toEqual([]);
  });

  it('returns empty array when no mirror found', async () => {
    const manifest = JSON.stringify([{ kind: 'report', title: 'T', uri: '/a', status: 'draft' }]);
    mockSandbox.exec.mockResolvedValue({ isErr: () => false, isOk: () => true, value: { stdout: manifest, stderr: '', exitCode: 0 } });
    mockEm.findOne.mockResolvedValue(null);
    const result = await collectArtifacts({ sandboxId: 'sb-1', tenantId: 't-1', temporalWorkflowId: 'wf-1' });
    expect(result).toHaveLength(1);
    expect(mockEm.persist).not.toHaveBeenCalled();
  });
});

describe('cleanupAndEscalate', () => {
  it('updates mirror to blocked_terminal', async () => {
    mockEm.findOne.mockResolvedValue({ state: 'implementing', temporalWorkflowId: 'wf-1' });
    await cleanupAndEscalate({ tenantId: 't-1', workflowId: 'wf-1', repoUrl: 'url', errorMessage: 'agent failed' });
    expect(mockEm.flush).toHaveBeenCalled();
  });
});

describe('invokeAgent', () => {
  const baseInput = {
    tenantId: 't-1', temporalWorkflowId: 'wf-1', sandboxId: 'sb-1',
    mode: 'implement' as const, repoUrl: 'https://github.com/test/repo', repoId: 'repo-1',
  };

  beforeEach(() => {
    mockEm.findOneOrFail.mockResolvedValue({
      id: 't-1', defaultAgentProvider: 'claude-code', defaultAgentModel: 'claude-sonnet-4-20250514',
      mcpServerPolicy: 'open',
    });
    mockEm.findOne.mockResolvedValue(null);
    mockSandbox.exec.mockResolvedValue({
      isErr: () => false, isOk: () => true,
      value: { stdout: ' 3 files changed\n src/a.ts | 10 +\n src/b.ts | 5 -', stderr: '', exitCode: 0 },
    });
  });

  it('returns successful AgentResult', async () => {
    const result = await invokeAgent(baseInput);
    expect(result.status).toBe('success');
    expect(result.provider).toBe('claude-code');
    expect(result.sessionId).toBeDefined();
    expect(result.cost.totalUsd).toBeGreaterThan(0);
  });

  it('creates and persists AgentSession', async () => {
    await invokeAgent(baseInput);
    expect(mockEm.persist).toHaveBeenCalled();
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it('returns failure when agent invocation fails', async () => {
    mockRegistry._mockProvider.invoke.mockResolvedValue({
      isErr: () => true, isOk: () => false,
      error: { message: 'Agent crashed', code: 'AGENT_ERROR' },
    });
    const result = await invokeAgent(baseInput);
    expect(result.status).toBe('failure');
    expect(result.errorMessage).toBe('Agent crashed');
  });

  it('sanitizes input when sanitizer available', async () => {
    await invokeAgent(baseInput);
    expect(mockSanitizer.sanitizeInput).toHaveBeenCalled();
  });

  it('scans output for security findings', async () => {
    mockSanitizer.scanOutput.mockReturnValue({ clean: false, findings: ['credential leak'] });
    await invokeAgent(baseInput);
    expect(mockSanitizer.scanOutput).toHaveBeenCalled();
  });

  it('revokes session token after invocation', async () => {
    await invokeAgent(baseInput);
    expect(mockCredProxy.revokeSession).toHaveBeenCalledWith('session-token-1');
  });

  it('resolves provider with tenant and repo config', async () => {
    mockEm.findOne.mockResolvedValue({ agentProvider: 'openai', agentModel: 'gpt-4' });
    await invokeAgent(baseInput);
    expect(mockRegistry.resolveProvider).toHaveBeenCalledWith(
      expect.objectContaining({ tenantDefaultProvider: 'claude-code' }),
    );
  });

  it('formats prompt with repo info', async () => {
    await invokeAgent(baseInput);
    expect(mockFormatter.format).toHaveBeenCalledWith('claude-code', expect.objectContaining({
      taskSeed: expect.any(String),
      repoInfo: expect.objectContaining({ url: 'https://github.com/test/repo' }),
    }));
  });

  it('runs static analysis when repo config has command', async () => {
    mockEm.findOne
      .mockResolvedValueOnce({ staticAnalysisCommand: 'npm run lint' })
      .mockResolvedValueOnce({ id: 'mirror-1', branchName: 'ai/task' });
    mockSandbox.exec
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: ' 2 files\n a.ts | 5 +', stderr: '', exitCode: 0 } })
      .mockResolvedValueOnce({ isErr: () => false, isOk: () => true, value: { stdout: 'all good', stderr: '', exitCode: 0 } });
    const result = await invokeAgent(baseInput);
    expect(result.status).toBe('success');
  });
});
