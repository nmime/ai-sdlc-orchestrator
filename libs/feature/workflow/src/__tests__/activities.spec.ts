import {
  initActivities,
  updateWorkflowMirror,
  reserveBudget,
  settleCost,
  createSandbox,
  invokeAgent,
  verifyAgentOutput,
  collectArtifacts,
  cleanupAndEscalate,
  destroySandbox,
  pauseSandbox,
  resumeSandbox,
} from '../activities/orchestrate-task.activities';

const mockMirror = {
  id: 'wf-1',
  state: 'queued',
  temporalWorkflowId: 'twf-1',
  currentStepId: undefined as string | undefined,
  branchName: undefined as string | undefined,
  mrUrl: undefined as string | undefined,
  costUsdTotal: 0,
  aiCostUsd: 0,
  sandboxCostUsd: 0,
  updatedAt: undefined as Date | undefined,
};

const mockTenant = {
  id: 'tenant-1',
  monthlyCostActualUsd: 100,
  monthlyCostReservedUsd: 50,
  monthlyCostLimitUsd: 1000,
  budgetVersion: 1,
  monthlyAiCostActualUsd: 80,
  monthlySandboxCostActualUsd: 20,
};

const mockEm = {
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  find: vi.fn().mockResolvedValue([]),
  persist: vi.fn(),
  flush: vi.fn(),
  nativeUpdate: vi.fn().mockResolvedValue(1),
  getReference: vi.fn().mockReturnValue({ id: 'tenant-1' }),
  fork: vi.fn(),
};
mockEm.fork.mockReturnValue(mockEm);

const mockSandboxAdapter = {
  create: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, value: { sandboxId: 'sb-1' } }),
  exec: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, value: { stdout: 'ok', stderr: '', exitCode: 0 } }),
  destroy: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, value: undefined }),
  pause: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, value: undefined }),
  resume: vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false, value: { sandboxId: 'sb-new' } }),
};

const mockAgentResult = {
  isOk: () => true,
  isErr: () => false,
  value: {
    success: true,
    filesChanged: 3,
    inputTokens: 1000,
    outputTokens: 500,
    aiCostUsd: 0.5,
    sandboxCostUsd: 0.1,
    artifacts: [],
  },
};

const mockAgent = {
  invoke: vi.fn().mockResolvedValue(mockAgentResult),
};

const mockRegistry = {
  getOrThrow: vi.fn().mockReturnValue(mockAgent),
};

const mockPromptFormatter = {
  format: vi.fn().mockReturnValue('formatted prompt'),
};

const mockCredentialProxy = {
  baseUrl: 'http://localhost:3001',
};

beforeAll(() => {
  initActivities({
    em: mockEm as any,
    sandboxAdapter: mockSandboxAdapter as any,
    agentRegistry: mockRegistry as any,
    promptFormatter: mockPromptFormatter as any,
    credentialProxy: mockCredentialProxy as any,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mockEm.fork.mockReturnValue(mockEm);
  mockEm.nativeUpdate.mockResolvedValue(1);
});

describe('updateWorkflowMirror', () => {
  it('should create new mirror if not exists', async () => {
    mockEm.findOne.mockResolvedValue(null);
    await updateWorkflowMirror({
      tenantId: 'tenant-1',
      temporalWorkflowId: 'twf-1',
      state: 'implementing',
    });
    expect(mockEm.persist).toHaveBeenCalled();
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it('should update existing mirror state', async () => {
    const existing = { ...mockMirror };
    mockEm.findOne.mockResolvedValue(existing);
    await updateWorkflowMirror({
      tenantId: 'tenant-1',
      temporalWorkflowId: 'twf-1',
      state: 'awaiting_gate',
      currentStepId: 'step-2',
    });
    expect(existing.state).toBe('awaiting_gate');
    expect(existing.currentStepId).toBe('step-2');
  });

  it('should set updatedAt on terminal states', async () => {
    const existing = { ...mockMirror };
    mockEm.findOne.mockResolvedValue(existing);
    await updateWorkflowMirror({
      tenantId: 'tenant-1',
      temporalWorkflowId: 'twf-1',
      state: 'completed',
    });
    expect(existing.updatedAt).toBeInstanceOf(Date);
  });
});

describe('reserveBudget', () => {
  it('should reserve budget successfully', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockTenant });
    await expect(reserveBudget({ tenantId: 'tenant-1', estimatedCostUsd: 10 })).resolves.toBeUndefined();
    expect(mockEm.nativeUpdate).toHaveBeenCalled();
  });

  it('should throw on budget exceeded', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockTenant, monthlyCostLimitUsd: 160 });
    await expect(
      reserveBudget({ tenantId: 'tenant-1', estimatedCostUsd: 100 }),
    ).rejects.toThrow('Budget exceeded');
  });

  it('should throw on concurrency conflict', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockTenant });
    mockEm.nativeUpdate.mockResolvedValue(0);
    await expect(
      reserveBudget({ tenantId: 'tenant-1', estimatedCostUsd: 10 }),
    ).rejects.toThrow('concurrency conflict');
  });
});

describe('settleCost', () => {
  it('should settle costs and release reservation', async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockTenant });
    await settleCost({
      tenantId: 'tenant-1',
      reservedUsd: 20,
      actualAiCostUsd: 5,
      actualSandboxCostUsd: 2,
    });
    expect(mockEm.nativeUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'tenant-1' }),
      expect.objectContaining({
        monthlyCostActualUsd: expect.any(Number),
      }),
    );
  });
});

describe('createSandbox', () => {
  it('should create sandbox with valid repo URL', async () => {
    const result = await createSandbox({
      tenantId: 'tenant-1',
      repoUrl: 'https://github.com/org/repo.git',
    });
    expect(result.sandboxId).toBe('sb-1');
    expect(mockSandboxAdapter.create).toHaveBeenCalled();
    expect(mockSandboxAdapter.exec).toHaveBeenCalledWith(
      'sb-1',
      'git clone https://github.com/org/repo.git /workspace',
    );
  });

  it('should reject invalid repo URL', async () => {
    await expect(
      createSandbox({ tenantId: 'tenant-1', repoUrl: 'file:///etc/passwd' }),
    ).rejects.toThrow('Invalid repository URL');
  });

  it('should reject HTTP repo URL', async () => {
    await expect(
      createSandbox({ tenantId: 'tenant-1', repoUrl: 'http://github.com/org/repo' }),
    ).rejects.toThrow('Invalid repository URL');
  });
});

describe('invokeAgent', () => {
  it('should invoke agent and return success result', async () => {
    const result = await invokeAgent({
      tenantId: 'tenant-1',
      sandboxId: 'sb-1',
      mode: 'implement',
      repoUrl: 'https://github.com/org/repo',
    });
    expect(result.status).toBe('success');
    expect(result.provider).toBe('claude');
    expect(result.cost.ai.usd).toBe(0.5);
  });

  it('should return failure result when agent errors', async () => {
    mockAgent.invoke.mockResolvedValueOnce({
      isOk: () => false,
      isErr: () => true,
      error: { code: 'AGENT_ERROR', message: 'timeout' },
    });

    const result = await invokeAgent({
      tenantId: 'tenant-1',
      sandboxId: 'sb-1',
      mode: 'implement',
      repoUrl: 'https://github.com/org/repo',
    });
    expect(result.status).toBe('failure');
    expect(result.errorMessage).toBe('timeout');
  });
});

describe('verifyAgentOutput', () => {
  it('should skip verification when no branchName', async () => {
    await verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'https://github.com/org/repo' });
    expect(mockSandboxAdapter.exec).not.toHaveBeenCalled();
  });

  it('should verify diff and commits exist', async () => {
    mockSandboxAdapter.exec
      .mockResolvedValueOnce({ isOk: () => true, isErr: () => false, value: { stdout: '3 files changed' } })
      .mockResolvedValueOnce({ isOk: () => true, isErr: () => false, value: { stdout: 'abc123 commit msg' } });

    await verifyAgentOutput({
      sandboxId: 'sb-1',
      repoUrl: 'https://github.com/org/repo',
      branchName: 'feature/test',
    });
  });

  it('should throw when no commits found', async () => {
    mockSandboxAdapter.exec
      .mockResolvedValueOnce({ isOk: () => true, isErr: () => false, value: { stdout: 'diff' } })
      .mockResolvedValueOnce({ isOk: () => true, isErr: () => false, value: { stdout: '' } });

    await expect(
      verifyAgentOutput({ sandboxId: 'sb-1', repoUrl: 'https://x.com/r', branchName: 'f' }),
    ).rejects.toThrow('No commits found');
  });
});

describe('collectArtifacts', () => {
  it('should return artifacts from manifest', async () => {
    mockSandboxAdapter.exec.mockResolvedValueOnce({
      isOk: () => true,
      isErr: () => false,
      value: { stdout: JSON.stringify([{ name: 'report.html', url: '/artifacts/report.html' }]) },
    });
    const artifacts = await collectArtifacts({ sandboxId: 'sb-1' });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].name).toBe('report.html');
  });

  it('should return empty array when no manifest', async () => {
    mockSandboxAdapter.exec.mockResolvedValueOnce({
      isOk: () => false,
      isErr: () => true,
      error: { code: 'SANDBOX_ERROR', message: 'file not found' },
    });
    const artifacts = await collectArtifacts({ sandboxId: 'sb-1' });
    expect(artifacts).toEqual([]);
  });
});

describe('destroySandbox', () => {
  it('should call sandbox adapter destroy', async () => {
    await destroySandbox({ sandboxId: 'sb-1' });
    expect(mockSandboxAdapter.destroy).toHaveBeenCalledWith('sb-1');
  });
});

describe('pauseSandbox', () => {
  it('should call sandbox adapter pause', async () => {
    await pauseSandbox({ sandboxId: 'sb-1' });
    expect(mockSandboxAdapter.pause).toHaveBeenCalledWith('sb-1');
  });
});

describe('resumeSandbox', () => {
  it('should call sandbox adapter resume and return new id', async () => {
    const result = await resumeSandbox({ sandboxId: 'sb-1' });
    expect(result.sandboxId).toBe('sb-new');
  });
});

describe('cleanupAndEscalate', () => {
  it('should update workflow mirror to blocked_terminal', async () => {
    mockEm.findOne.mockResolvedValue({ ...mockMirror });
    await cleanupAndEscalate({
      tenantId: 'tenant-1',
      workflowId: 'twf-1',
      repoUrl: 'https://github.com/org/repo',
    });
    expect(mockEm.flush).toHaveBeenCalled();
  });
});
