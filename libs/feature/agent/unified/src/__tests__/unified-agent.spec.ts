import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStepCountIs = vi.fn((n: number) => ({ type: 'step-count', maxSteps: n }));

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: (...args: unknown[]) => mockStepCountIs(...args as [number]),
  zodSchema: (schema: unknown) => ({ _type: 'json-schema', jsonSchema: {}, validate: () => ({ success: true, value: {} }), _schema: schema }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => (model: string) => ({ modelId: model, provider: 'openai' }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (model: string) => ({ modelId: model, provider: 'anthropic' }),
  anthropic: () => ({ modelId: 'default', provider: 'anthropic' }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (model: string) => ({ modelId: model, provider: 'google' }),
}));

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: () => (model: string) => ({ modelId: model, provider: 'mistral' }),
}));

vi.mock('@ai-sdk/xai', () => ({
  createXai: () => (model: string) => ({ modelId: model, provider: 'xai' }),
}));

vi.mock('@ai-sdk/amazon-bedrock', () => ({
  createAmazonBedrock: () => (model: string) => ({ modelId: model, provider: 'bedrock' }),
}));

import { generateText } from 'ai';
import { UnifiedAgentAdapter } from '../unified-agent.adapter';

const mockGenerateText = vi.mocked(generateText);

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createConfig(overrides: Record<string, string | number> = {}) {
  const values: Record<string, string | number> = {
    OPENAI_API_KEY: 'test-key',
    OPENAI_BASE_URL: 'https://api.test.com/v1',
    DEFAULT_AGENT_PROVIDER: 'openai',
    DEFAULT_AGENT_MODEL: 'gpt-4o',
    AGENT_MAX_TURNS: 3,
    AI_INPUT_COST_PER_1M: 3.0,
    AI_OUTPUT_COST_PER_1M: 15.0,
    SANDBOX_COST_PER_HOUR_USD: 0.05,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as any;
}

function makeGenerateResult(overrides: Record<string, unknown> = {}) {
  return {
    text: 'Done!',
    usage: { inputTokens: 100, outputTokens: 50 },
    steps: [{}],
    finishReason: 'stop',
    ...overrides,
  } as any;
}

const defaultInput = {
  sessionId: 'test-session',
  provider: 'openai' as const,
  prompt: 'Test prompt',
  sandboxId: 'sb-123',
  maxDurationMs: 60000,
  maxCostUsd: 10,
};

describe('UnifiedAgentAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to openai provider', () => {
    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any);
    expect(adapter.name).toBe('openai');
  });

  it('detects anthropic provider from ANTHROPIC_API_KEY', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig({ ANTHROPIC_API_KEY: 'sk-ant-test', OPENAI_API_KEY: '', DEFAULT_AGENT_PROVIDER: 'auto' }),
      mockLogger as any,
    );
    expect(adapter.name).toBe('anthropic');
  });

  it('detects google provider from GOOGLE_GENERATIVE_AI_API_KEY', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig({ GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key', OPENAI_API_KEY: '', DEFAULT_AGENT_PROVIDER: 'auto' }),
      mockLogger as any,
    );
    expect(adapter.name).toBe('google');
  });

  it('accepts custom name via opts', () => {
    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any, { name: 'custom' });
    expect(adapter.name).toBe('custom');
  });

  it('invokes generateText and returns result', async () => {
    mockGenerateText.mockResolvedValueOnce(makeGenerateResult());

    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any);
    const result = await adapter.invoke(defaultInput);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.success).toBe(true);
      expect(result.value.inputTokens).toBe(100);
      expect(result.value.outputTokens).toBe(50);
    }
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('handles API errors', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('Rate limited'));

    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any);
    const result = await adapter.invoke(defaultInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('AGENT_ERROR');
      expect(result.error.message).toContain('Rate limited');
    }
  });

  it('cancel returns NOT_FOUND for unknown session', async () => {
    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any);
    const result = await adapter.cancel('unknown');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('passes stopWhen from config', async () => {
    mockGenerateText.mockResolvedValueOnce(makeGenerateResult({ usage: { inputTokens: 10, outputTokens: 5 } }));

    const adapter = new UnifiedAgentAdapter(createConfig({ AGENT_MAX_TURNS: 10 }), mockLogger as any);
    await adapter.invoke({ ...defaultInput, sessionId: 's1' });

    expect(mockStepCountIs).toHaveBeenCalledWith(10);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: expect.objectContaining({ type: 'step-count', maxSteps: 10 }),
      }),
    );
  });

  it('sends anthropic providerOptions when using anthropic', async () => {
    mockGenerateText.mockResolvedValueOnce(makeGenerateResult());

    const adapter = new UnifiedAgentAdapter(
      createConfig({ ANTHROPIC_API_KEY: 'sk-ant-test', DEFAULT_AGENT_PROVIDER: 'anthropic' }),
      mockLogger as any,
    );
    await adapter.invoke(defaultInput);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: expect.objectContaining({
          anthropic: expect.objectContaining({
            sendReasoning: true,
            thinking: { type: 'adaptive' },
          }),
        }),
      }),
    );
  });

  it('detects mistral provider from MISTRAL_API_KEY', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig({ MISTRAL_API_KEY: 'test-key', OPENAI_API_KEY: '', DEFAULT_AGENT_PROVIDER: 'auto' }),
      mockLogger as any,
    );
    expect(adapter.name).toBe('mistral');
  });

  it('detects xai provider from XAI_API_KEY', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig({ XAI_API_KEY: 'test-key', OPENAI_API_KEY: '', DEFAULT_AGENT_PROVIDER: 'auto' }),
      mockLogger as any,
    );
    expect(adapter.name).toBe('xai');
  });

  it('detects bedrock provider from AWS_ACCESS_KEY_ID', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig({ AWS_ACCESS_KEY_ID: 'AKIA...', AWS_SECRET_ACCESS_KEY: 'secret', OPENAI_API_KEY: '', DEFAULT_AGENT_PROVIDER: 'auto' }),
      mockLogger as any,
    );
    expect(adapter.name).toBe('bedrock');
  });

  it('creates openai-compatible adapter with custom opts', () => {
    const adapter = new UnifiedAgentAdapter(
      createConfig(),
      mockLogger as any,
      { providerType: 'openai-compatible', name: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'llama3.1' },
    );
    expect(adapter.name).toBe('ollama');
  });

  it('passes tools with execute functions to generateText', async () => {
    mockGenerateText.mockResolvedValueOnce(makeGenerateResult());

    const adapter = new UnifiedAgentAdapter(createConfig(), mockLogger as any);
    await adapter.invoke(defaultInput);

    const call = mockGenerateText.mock.calls[0]?.[0] as any;
    expect(call.tools).toBeDefined();
    const toolNames = Object.keys(call.tools);
    expect(toolNames).toEqual(['execute_command', 'write_file', 'read_file', 'search_files', 'list_files']);
    for (const name of toolNames) {
      expect(typeof call.tools[name].execute).toBe('function');
      expect(typeof call.tools[name].description).toBe('string');
      expect(call.tools[name].parameters).toBeDefined();
    }
  });
});
