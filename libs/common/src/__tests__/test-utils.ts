import { vi } from 'vitest';

export function createMockEm(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findOneOrFail: vi.fn(),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    count: vi.fn().mockResolvedValue(0),
    persist: vi.fn().mockReturnThis(),
    persistAndFlush: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    removeAndFlush: vi.fn().mockResolvedValue(undefined),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    getReference: vi.fn((_, id) => ({ id })),
    fork: vi.fn(),
    ...overrides,
  };
}

export function createMockLogger() {
  return {
    setContext: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
}

export function createMockTemporalClient() {
  const mockHandle = {
    signal: vi.fn().mockResolvedValue(undefined),
    describe: vi.fn().mockResolvedValue({ status: { name: 'RUNNING' }, runId: 'run-1' }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getClient: vi.fn().mockResolvedValue({
      workflow: {
        getHandle: vi.fn().mockReturnValue(mockHandle),
        start: vi.fn().mockResolvedValue({ workflowId: 'wf-1', firstExecutionRunId: 'run-1' }),
      },
    }),
    _mockHandle: mockHandle,
  };
}

export function createMockSandboxAdapter() {
  return {
    create: vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: { sandboxId: 'sb-1' } }),
    exec: vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: { stdout: '', stderr: '', exitCode: 0 } }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: { sandboxId: 'sb-1' } }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockAgentRegistry() {
  const mockProvider = {
    invoke: vi.fn().mockResolvedValue({
      isErr: () => false,
      isOk: () => true,
      value: {
        success: true,
        filesChanged: 3,
        inputTokens: 1000,
        outputTokens: 500,
        aiCostUsd: 0.05,
        sandboxCostUsd: 0.02,
        artifacts: [],
      },
    }),
    cancel: vi.fn(),
  };
  return {
    resolveProvider: vi.fn().mockReturnValue({
      providerName: 'claude-code',
      model: 'claude-sonnet-4-20250514',
      provider: mockProvider,
    }),
    _mockProvider: mockProvider,
  };
}

export function createMockPromptFormatter() {
  return {
    format: vi.fn().mockReturnValue('formatted-prompt'),
  };
}

export function createMockCredentialProxy() {
  return {
    createSession: vi.fn().mockResolvedValue({ isOk: () => true, value: { token: 'session-token-1' } }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockMcpPolicyService() {
  return {
    filterServers: vi.fn().mockResolvedValue([]),
  };
}

export function createMockPromptSanitizer() {
  return {
    sanitizeInput: vi.fn().mockReturnValue({ sanitized: 'clean input', findings: [] }),
    scanOutput: vi.fn().mockReturnValue({ clean: true, findings: [] }),
  };
}
