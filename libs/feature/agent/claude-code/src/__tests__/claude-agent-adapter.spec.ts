import { ClaudeAgentAdapter } from '../claude-agent.adapter';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));

describe('ClaudeAgentAdapter', () => {
  const configService = { get: vi.fn().mockReturnValue('sk-test') } as any;
  const logger = { setContext: vi.fn(), log: vi.fn(), error: vi.fn() } as any;
  let adapter: ClaudeAgentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAgentAdapter(configService, logger);
  });

  it('should have name claude_code', () => {
    expect(adapter.name).toBe('claude_code');
  });

  it('should invoke and return success result', async () => {
    mockCreate.mockResolvedValue({
      usage: { input_tokens: 1000, output_tokens: 500 },
    });

    const result = await adapter.invoke({
      sessionId: 'sess-1',
      provider: 'claude',
      prompt: 'do stuff',
      sandboxId: 'sb-1',
      maxDurationMs: 60000,
      maxCostUsd: 10,
      credentialProxyUrl: 'http://localhost:3001',
    });

    expect(result.isOk()).toBe(true);
    const output = result._unsafeUnwrap();
    expect(output.success).toBe(true);
    expect(output.inputTokens).toBe(1000);
    expect(output.outputTokens).toBe(500);
    expect(output.aiCostUsd).toBeGreaterThan(0);
  });

  it('should calculate cost correctly', async () => {
    mockCreate.mockResolvedValue({
      usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
    });

    const result = await adapter.invoke({
      sessionId: 'sess-cost',
      provider: 'claude',
      prompt: 'test',
      sandboxId: 'sb-1',
      maxDurationMs: 60000,
      maxCostUsd: 100,
      credentialProxyUrl: 'http://localhost:3001',
    });

    expect(result.isOk()).toBe(true);
    const output = result._unsafeUnwrap();
    expect(output.aiCostUsd).toBeCloseTo(18.0, 1);
  });

  it('should return error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limited'));

    const result = await adapter.invoke({
      sessionId: 'sess-2',
      provider: 'claude',
      prompt: 'do stuff',
      sandboxId: 'sb-1',
      maxDurationMs: 60000,
      maxCostUsd: 10,
      credentialProxyUrl: 'http://localhost:3001',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('AGENT_ERROR');
  });

  it('should clean up session after invoke', async () => {
    mockCreate.mockResolvedValue({ usage: { input_tokens: 100, output_tokens: 50 } });

    await adapter.invoke({
      sessionId: 'sess-3',
      provider: 'claude',
      prompt: 'task',
      sandboxId: 'sb-1',
      maxDurationMs: 60000,
      maxCostUsd: 10,
      credentialProxyUrl: 'http://localhost:3001',
    });

    const cancelResult = await adapter.cancel('sess-3');
    expect(cancelResult.isErr()).toBe(true);
    expect(cancelResult._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('should return NOT_FOUND when cancelling non-existent session', async () => {
    const result = await adapter.cancel('non-existent');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});
