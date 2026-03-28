import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAgentAdapter } from '../claude-agent.adapter';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const mockConfig = {
  get: vi.fn((key: string) => {
    const map: Record<string, string> = {
      ANTHROPIC_API_KEY: 'test-key',
      AGENT_MAX_TURNS: '3',
      DEFAULT_AGENT_MODEL: 'claude-sonnet-4-20250514',
      AI_INPUT_COST_PER_1M: '3.0',
      AI_OUTPUT_COST_PER_1M: '15.0',
      SANDBOX_COST_PER_HOUR_USD: '0.05',
    };
    return map[key] ?? undefined;
  }),
};

describe('ClaudeAgentAdapter', () => {
  let adapter: ClaudeAgentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAgentAdapter(mockConfig as any, mockLogger as any);
  });

  it('has correct name', () => {
    expect(adapter.name).toBe('claude_code');
  });

  describe('invoke', () => {
    it('returns success when agent completes without tools', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await adapter.invoke({
        sessionId: 'sess-1',
        prompt: 'Do a task',
        sandboxId: 'sb-1',
        maxCostUsd: 10,
      } as any);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.success).toBe(true);
        expect(result.value.inputTokens).toBe(100);
        expect(result.value.outputTokens).toBe(50);
        expect(result.value.aiCostUsd).toBeGreaterThan(0);
      }
    });

    it('handles API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

      const result = await adapter.invoke({
        sessionId: 'sess-2',
        prompt: 'Do task',
        sandboxId: 'sb-1',
        maxCostUsd: 10,
      } as any);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('AGENT_ERROR');
        expect(result.error.message).toContain('API rate limited');
      }
    });

    it('respects max turns limit', async () => {
      mockCreate.mockResolvedValue({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu-1', name: 'read_file', input: { path: 'test.ts' } }],
        usage: { input_tokens: 50, output_tokens: 25 },
      });

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('file content', { status: 200 }),
      );

      const result = await adapter.invoke({
        sessionId: 'sess-3',
        prompt: 'task',
        sandboxId: 'sb-1',
        maxCostUsd: 100,
      } as any);

      expect(result.isOk()).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();
    });

    it('cleans up session on completion', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.invoke({
        sessionId: 'sess-cleanup',
        prompt: 'task',
        sandboxId: 'sb-1',
        maxCostUsd: 10,
      } as any);

      const cancelResult = await adapter.cancel('sess-cleanup');
      expect(cancelResult.isErr()).toBe(true);
    });
  });

  describe('cancel', () => {
    it('returns error for unknown session', async () => {
      const result = await adapter.cancel('unknown');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('sanitizePath', () => {
    it('resolves relative paths within root', () => {
      const sanitize = (adapter as any).sanitizePath.bind(adapter);
      expect(sanitize('src/index.ts', '/home/user/repo')).toBe('/home/user/repo/src/index.ts');
    });

    it('blocks path traversal', () => {
      const sanitize = (adapter as any).sanitizePath.bind(adapter);
      expect(sanitize('../../etc/passwd', '/home/user/repo')).toBe('/home/user/repo');
    });

    it('strips special characters', () => {
      const sanitize = (adapter as any).sanitizePath.bind(adapter);
      const result = sanitize('src/fi le$name.ts', '/home/user/repo');
      expect(result).not.toContain('$');
      expect(result).not.toContain(' ');
    });

    it('handles empty path', () => {
      const sanitize = (adapter as any).sanitizePath.bind(adapter);
      expect(sanitize('', '/home/user/repo')).toBe('/home/user/repo');
    });
  });

  describe('calculateCost', () => {
    it('calculates cost based on token counts', () => {
      const calcCost = (adapter as any).calculateCost.bind(adapter);
      const cost = calcCost(1_000_000, 0);
      expect(cost).toBe(3.0);
    });

    it('calculates output tokens cost', () => {
      const calcCost = (adapter as any).calculateCost.bind(adapter);
      const cost = calcCost(0, 1_000_000);
      expect(cost).toBe(15.0);
    });

    it('returns 0 for no tokens', () => {
      const calcCost = (adapter as any).calculateCost.bind(adapter);
      expect(calcCost(0, 0)).toBe(0);
    });
  });
});
