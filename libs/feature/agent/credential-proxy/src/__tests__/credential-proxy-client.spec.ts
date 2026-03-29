import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialProxyClient } from '../credential-proxy.client';

const mockLogger = { setContext: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockConfig = {
  get: (key: string) => {
    if (key === 'CREDENTIAL_PROXY_URL') return 'http://proxy:4000';
    if (key === 'CREDENTIAL_PROXY_INTERNAL_TOKEN') return 'internal-token';
    return undefined;
  },
};

describe('CredentialProxyClient', () => {
  let client: CredentialProxyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CredentialProxyClient(mockLogger as any, mockConfig as any);
  });

  describe('createSession', () => {
    it('creates session successfully', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'tok-1', expiresAt: '2026-01-01' }), { status: 200 }),
      );
      const result = await client.createSession('tenant-1', ['git:read']);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.token).toBe('tok-1');
      vi.restoreAllMocks();
    });

    it('returns error on HTTP failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
      const result = await client.createSession('tenant-1', ['git:read']);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.message).toContain('500');
      vi.restoreAllMocks();
    });

    it('returns error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await client.createSession('tenant-1', []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.message).toContain('unreachable');
      vi.restoreAllMocks();
    });
  });

  describe('getGitCredential', () => {
    it('returns credentials on success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'x-access-token', password: 'ghp_xxx' }), { status: 200 }),
      );
      const result = await client.getGitCredential('tok-1');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.username).toBe('x-access-token');
      vi.restoreAllMocks();
    });

    it('returns UNAUTHORIZED on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
      const result = await client.getGitCredential('bad-token');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('UNAUTHORIZED');
      vi.restoreAllMocks();
    });
  });

  describe('getMcpToken', () => {
    it('rejects invalid server names', async () => {
      const result = await client.getMcpToken('tok', 'bad server name!');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid server names', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'mcp-tok' }), { status: 200 }),
      );
      const result = await client.getMcpToken('tok', 'my-server_1');
      expect(result.isOk()).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe('revokeSession', () => {
    it('revokes session', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('', { status: 200 }));
      const result = await client.revokeSession('tok-1');
      expect(result.isOk()).toBe(true);
      vi.restoreAllMocks();
    });

    it('handles network error gracefully', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
      const result = await client.revokeSession('tok-1');
      expect(result.isErr()).toBe(true);
      vi.restoreAllMocks();
    });
  });
});
