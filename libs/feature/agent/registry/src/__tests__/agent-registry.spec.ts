import { AgentProviderRegistry } from '../agent-provider-registry';
import type { AiAgentPort } from '../ai-agent.port';
import { ok, err } from 'neverthrow';

const mockProvider: AiAgentPort = {
  name: 'test_provider',
  invoke: vi.fn().mockResolvedValue(ok({
    success: true,
    filesChanged: 5,
    inputTokens: 1000,
    outputTokens: 500,
    aiCostUsd: 0.05,
    sandboxCostUsd: 0.01,
    artifacts: [],
  })),
  cancel: vi.fn().mockResolvedValue(ok(undefined)),
};

const secondProvider: AiAgentPort = {
  name: 'second_provider',
  invoke: vi.fn().mockResolvedValue(ok({
    success: false,
    filesChanged: 0,
    inputTokens: 0,
    outputTokens: 0,
    aiCostUsd: 0,
    sandboxCostUsd: 0,
    artifacts: [],
    errorMessage: 'Test error',
  })),
  cancel: vi.fn().mockResolvedValue(err({ code: 'NOT_FOUND', message: 'No session' })),
};

describe('AgentProviderRegistry', () => {
  let registry: AgentProviderRegistry;

  beforeEach(() => {
    registry = new AgentProviderRegistry();
  });

  it('should register and retrieve a provider', () => {
    registry.register(mockProvider);
    expect(registry.get('test_provider')).toBe(mockProvider);
  });

  it('should return undefined for unregistered provider', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should throw for getOrThrow with unregistered provider', () => {
    expect(() => registry.getOrThrow('nonexistent')).toThrow('Agent provider');
  });

  it('should list all registered providers', () => {
    registry.register(mockProvider);
    registry.register(secondProvider);
    expect(registry.list()).toEqual(['test_provider', 'second_provider']);
  });

  it('should invoke agent through registry', async () => {
    registry.register(mockProvider);
    const agent = registry.getOrThrow('test_provider');
    const result = await agent.invoke({
      sessionId: 'test-session',
      provider: 'test_provider',
      prompt: 'Do something',
      sandboxId: 'sandbox-1',
      maxDurationMs: 300000,
      maxCostUsd: 50,
      credentialProxyUrl: 'http://localhost:4000',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.success).toBe(true);
      expect(result.value.filesChanged).toBe(5);
    }
  });

  it('should cancel agent through registry', async () => {
    registry.register(mockProvider);
    const agent = registry.getOrThrow('test_provider');
    const result = await agent.cancel('test-session');
    expect(result.isOk()).toBe(true);
  });
});
