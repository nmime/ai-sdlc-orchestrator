import { E2bSandboxAdapter } from '../e2b-sandbox.adapter';

const mockSandbox = vi.hoisted(() => ({
  sandboxId: 'sb-123',
  commands: { run: vi.fn() },
  files: { write: vi.fn(), read: vi.fn() },
  kill: vi.fn(),
}));

vi.mock('e2b', () => ({
  Sandbox: {
    create: vi.fn().mockResolvedValue(mockSandbox),
    connect: vi.fn().mockResolvedValue(mockSandbox),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('E2bSandboxAdapter - extended coverage', () => {
  const configService = { get: vi.fn().mockReturnValue('e2b-key') } as any;
  const logger = { setContext: vi.fn(), log: vi.fn(), error: vi.fn() } as any;
  let adapter: E2bSandboxAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new E2bSandboxAdapter(configService, logger);
  });

  describe('writeFile errors', () => {
    it('should return error when sandbox write throws', async () => {
      await adapter.create({});
      mockSandbox.files.write.mockRejectedValueOnce(new Error('disk full'));
      const result = await adapter.writeFile('sb-123', '/tmp/f', 'data');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('disk full');
    });
  });

  describe('readFile errors', () => {
    it('should return error when sandbox read throws', async () => {
      await adapter.create({});
      mockSandbox.files.read.mockRejectedValueOnce(new Error('file not found'));
      const result = await adapter.readFile('sb-123', '/tmp/missing');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('file not found');
    });

    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.readFile('unknown', '/tmp/f');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });
  });

  describe('exec errors', () => {
    it('should return error when sandbox exec throws', async () => {
      await adapter.create({});
      mockSandbox.commands.run.mockRejectedValueOnce(new Error('command timeout'));
      const result = await adapter.exec('sb-123', 'sleep 999');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('command timeout');
    });
  });

  describe('destroy errors', () => {
    it('should return error when sandbox kill throws', async () => {
      await adapter.create({});
      mockSandbox.kill.mockRejectedValueOnce(new Error('kill failed'));
      const result = await adapter.destroy('sb-123');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('kill failed');
    });
  });

  describe('uploadArtifact', () => {
    it('should upload artifact successfully', async () => {
      await adapter.create({});
      mockSandbox.files.read.mockResolvedValueOnce('file-content');
      const result = await adapter.uploadArtifact('sb-123', '/tmp/report.html', 'https://s3.example.com/report');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('https://s3.example.com/report');
    });

    it('should propagate read errors during upload', async () => {
      await adapter.create({});
      mockSandbox.files.read.mockRejectedValueOnce(new Error('read error'));
      const result = await adapter.uploadArtifact('sb-123', '/tmp/f', 'https://s3.example.com/x');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('pause', () => {
    it('should pause sandbox via API', async () => {
      await adapter.create({});
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await adapter.pause('sb-123');
      expect(result.isOk()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.e2b.dev/sandboxes/sb-123/pause',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return error when API returns non-ok', async () => {
      await adapter.create({});
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server error' });
      const result = await adapter.pause('sb-123');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('HTTP 500');
    });

    it('should return error when fetch throws', async () => {
      await adapter.create({});
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      const result = await adapter.pause('sb-123');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('network error');
    });
  });

  describe('resume', () => {
    it('should resume sandbox via API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sandboxId: 'sb-new' }),
      });
      const { Sandbox } = await import('e2b');
      (Sandbox.connect as any).mockResolvedValueOnce({ sandboxId: 'sb-new' });

      const result = await adapter.resume('sb-123');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().sandboxId).toBe('sb-new');
    });

    it('should return error when API returns non-ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' });
      const result = await adapter.resume('sb-missing');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('HTTP 404');
    });

    it('should return error when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));
      const result = await adapter.resume('sb-123');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('timeout');
    });
  });

  describe('create with env', () => {
    it('should pass env variables to sandbox', async () => {
      const { Sandbox } = await import('e2b');
      await adapter.create({ templateId: 'node', env: { NODE_ENV: 'test' } });
      expect(Sandbox.create).toHaveBeenCalledWith('node', expect.objectContaining({
        envs: { NODE_ENV: 'test' },
      }));
    });
  });
});
