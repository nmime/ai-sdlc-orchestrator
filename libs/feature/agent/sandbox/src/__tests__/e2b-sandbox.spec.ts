import { describe, it, expect, vi, beforeEach } from 'vitest';
import { E2bSandboxAdapter } from '../e2b-sandbox.adapter';

const mockRun = vi.fn();
const mockWrite = vi.fn();
const mockRead = vi.fn();
const mockKill = vi.fn();

vi.mock('e2b', () => ({
  Sandbox: {
    create: vi.fn().mockImplementation(() => Promise.resolve({
      sandboxId: 'sb-123',
      commands: { run: mockRun },
      files: { write: mockWrite, read: mockRead },
      kill: mockKill,
    })),
    connect: vi.fn().mockImplementation(() => Promise.resolve({
      sandboxId: 'sb-123',
      commands: { run: mockRun },
      files: { write: mockWrite, read: mockRead },
      kill: mockKill,
    })),
  },
}));

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockConfig = {
  get: (key: string) => key === 'E2B_API_KEY' ? 'test-key' : undefined,
};

describe('E2bSandboxAdapter', () => {
  let adapter: E2bSandboxAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new E2bSandboxAdapter(mockConfig as any, mockLogger as any);
  });

  it('has correct name', () => {
    expect(adapter.name).toBe('e2b');
  });

  describe('create', () => {
    it('creates a sandbox and tracks it', async () => {
      const result = await adapter.create({});
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.sandboxId).toBe('sb-123');
    });

    it('handles creation failure', async () => {
      const { Sandbox } = await import('e2b');
      vi.mocked(Sandbox.create).mockRejectedValueOnce(new Error('quota exceeded'));
      const result = await adapter.create({});
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('SANDBOX_ERROR');
    });
  });

  describe('exec', () => {
    it('returns NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.exec('unknown', 'ls');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('executes command on known sandbox', async () => {
      await adapter.create({});
      mockRun.mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 });
      const result = await adapter.exec('sb-123', 'echo ok');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stdout).toBe('ok');
        expect(result.value.exitCode).toBe(0);
      }
    });
  });

  describe('writeFile', () => {
    it('writes file to sandbox', async () => {
      await adapter.create({});
      mockWrite.mockResolvedValueOnce(undefined);
      const result = await adapter.writeFile('sb-123', '/test.txt', 'content');
      expect(result.isOk()).toBe(true);
    });

    it('returns NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.writeFile('unknown', '/test', 'c');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('readFile', () => {
    it('reads file from sandbox', async () => {
      await adapter.create({});
      mockRead.mockResolvedValueOnce('hello');
      const result = await adapter.readFile('sb-123', '/test.txt');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toBe('hello');
    });
  });

  describe('destroy', () => {
    it('destroys sandbox and removes from map', async () => {
      await adapter.create({});
      mockKill.mockResolvedValueOnce(undefined);
      const result = await adapter.destroy('sb-123');
      expect(result.isOk()).toBe(true);
      const execResult = await adapter.exec('sb-123', 'ls');
      expect(execResult.isErr()).toBe(true);
    });

    it('returns NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.destroy('unknown');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('uploadArtifact', () => {
    it('reads file and returns URL', async () => {
      await adapter.create({});
      mockRead.mockResolvedValueOnce('data');
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
      const result = await adapter.uploadArtifact('sb-123', '/file', 'https://dest');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toBe('https://dest');
      vi.restoreAllMocks();
    });
  });

  describe('pause', () => {
    it('returns NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.pause('unknown');
      expect(result.isErr()).toBe(true);
    });

    it('calls E2B pause API', async () => {
      await adapter.create({});
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
      const result = await adapter.pause('sb-123');
      expect(result.isOk()).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe('resume', () => {
    it('calls E2B resume API and reconnects', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ sandboxId: 'sb-456' }), { status: 200 }),
      );
      const result = await adapter.resume('sb-123');
      expect(result.isOk()).toBe(true);
      vi.restoreAllMocks();
    });
  });
});
