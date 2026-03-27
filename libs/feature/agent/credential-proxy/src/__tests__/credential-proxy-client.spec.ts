import { CredentialProxyClient } from '../credential-proxy.client';

describe('CredentialProxyClient', () => {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'CREDENTIAL_PROXY_URL') return 'http://localhost:3001';
      if (key === 'CREDENTIAL_PROXY_INTERNAL_TOKEN') return 'internal-secret';
      return '';
    }),
  } as any;
  const logger = { setContext: vi.fn(), log: vi.fn(), error: vi.fn() } as any;

  let client: CredentialProxyClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    client = new CredentialProxyClient(configService, logger);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should expose baseUrl', () => {
    expect(client.baseUrl).toBe('http://localhost:3001');
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'sess-token', expiresAt: '2025-01-01T00:00:00Z' }),
      });

      const result = await client.createSession('tenant-1', ['git']);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().token).toBe('sess-token');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-internal-token': 'internal-secret' }),
        }),
      );
    });

    it('should return error on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const result = await client.createSession('t1', []);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('500');
    });

    it('should return error on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await client.createSession('t1', []);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('ECONNREFUSED');
    });
  });

  describe('getGitCredential', () => {
    it('should get git credential successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ username: 'git', password: 'token-123' }),
      });
      const result = await client.getGitCredential('sess-token', 'github.com');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().username).toBe('git');
    });

    it('should return UNAUTHORIZED on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
      const result = await client.getGitCredential('bad-token');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('UNAUTHORIZED');
    });
  });

  describe('getMcpToken', () => {
    it('should get MCP token successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'mcp-token' }),
      });
      const result = await client.getMcpToken('sess-token', 'my-server');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().token).toBe('mcp-token');
    });

    it('should return UNAUTHORIZED on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
      const result = await client.getMcpToken('bad-token', 'server');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const result = await client.revokeSession('sess-id');
      expect(result.isOk()).toBe(true);
    });

    it('should return error on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
      const result = await client.revokeSession('sess-id');
      expect(result.isErr()).toBe(true);
    });

    it('should encode session ID in URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      await client.revokeSession('sess/with/slashes');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sess%2Fwith%2Fslashes'),
        expect.anything(),
      );
    });
  });
});
