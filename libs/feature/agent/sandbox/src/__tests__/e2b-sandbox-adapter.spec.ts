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

describe('E2bSandboxAdapter', () => {
  const configService = { get: vi.fn().mockReturnValue('e2b-key') } as any;
  const logger = { setContext: vi.fn(), log: vi.fn(), error: vi.fn() } as any;
  let adapter: E2bSandboxAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new E2bSandboxAdapter(configService, logger);
  });

  it('should have name e2b', () => {
    expect(adapter.name).toBe('e2b');
  });

  describe('create', () => {
    it('should create sandbox and return id', async () => {
      const result = await adapter.create({ timeoutMs: 60000 });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().sandboxId).toBe('sb-123');
    });

    it('should clamp timeout to MAX_TIMEOUT_MS', async () => {
      const { Sandbox } = await import('e2b');
      await adapter.create({ timeoutMs: 999999 });
      expect(Sandbox.create).toHaveBeenCalledWith(
        'base',
        expect.objectContaining({ timeoutMs: 300000 }),
      );
    });

    it('should return error on failure', async () => {
      const { Sandbox } = await import('e2b');
      (Sandbox.create as any).mockRejectedValueOnce(new Error('quota exceeded'));
      const result = await adapter.create({});
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('quota exceeded');
    });
  });

  describe('exec', () => {
    it('should execute command in sandbox', async () => {
      await adapter.create({});
      mockSandbox.commands.run.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
      const result = await adapter.exec('sb-123', 'ls -la');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().stdout).toBe('ok');
    });

    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.exec('unknown', 'ls');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    });

    it('should clamp exec timeout', async () => {
      await adapter.create({});
      mockSandbox.commands.run.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      await adapter.exec('sb-123', 'long-cmd', 999999);
      expect(mockSandbox.commands.run).toHaveBeenCalledWith('long-cmd', { timeoutMs: 120000 });
    });
  });

  describe('writeFile', () => {
    it('should write file to sandbox', async () => {
      await adapter.create({});
      const result = await adapter.writeFile('sb-123', '/tmp/test.txt', 'hello');
      expect(result.isOk()).toBe(true);
      expect(mockSandbox.files.write).toHaveBeenCalledWith('/tmp/test.txt', 'hello');
    });

    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.writeFile('unknown', '/tmp/f', 'data');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('readFile', () => {
    it('should read file from sandbox', async () => {
      await adapter.create({});
      mockSandbox.files.read.mockResolvedValue('file-contents');
      const result = await adapter.readFile('sb-123', '/tmp/test.txt');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('file-contents');
    });
  });

  describe('destroy', () => {
    it('should kill and remove sandbox', async () => {
      await adapter.create({});
      const result = await adapter.destroy('sb-123');
      expect(result.isOk()).toBe(true);
      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.destroy('unknown');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('pause', () => {
    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.pause('unknown');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('uploadArtifact', () => {
    it('should return NOT_FOUND for unknown sandbox', async () => {
      const result = await adapter.uploadArtifact('unknown', '/p', 'http://x');
      expect(result.isErr()).toBe(true);
    });
  });
});
