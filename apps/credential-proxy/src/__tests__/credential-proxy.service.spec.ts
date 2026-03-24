import { CredentialProxyService } from '../credential-proxy.service';

describe('CredentialProxyService', () => {
  let service: CredentialProxyService;

  beforeEach(() => {
    service = new CredentialProxyService();
  });

  describe('getGitCredential', () => {
    it('returns oauth2 username with env token', async () => {
      process.env['VCS_TOKEN_TEST_TENANT'] = 'test-token-123';
      const result = await service.getGitCredential('test-tenant', 'github.com');
      expect(result.username).toBe('oauth2');
      expect(result.password).toBe('test-token-123');
      delete process.env['VCS_TOKEN_TEST_TENANT'];
    });

    it('falls back to DEFAULT_VCS_TOKEN', async () => {
      process.env['DEFAULT_VCS_TOKEN'] = 'default-token';
      const result = await service.getGitCredential('unknown-tenant', 'github.com');
      expect(result.password).toBe('default-token');
      delete process.env['DEFAULT_VCS_TOKEN'];
    });

    it('returns empty password when no token configured', async () => {
      delete process.env['DEFAULT_VCS_TOKEN'];
      const result = await service.getGitCredential('no-token-tenant', 'github.com');
      expect(result.password).toBe('');
    });
  });

  describe('getMcpToken', () => {
    it('returns token from env', async () => {
      process.env['MCP_TOKEN_TEST_SERVER'] = 'mcp-token-value';
      const result = await service.getMcpToken('tenant-1', 'test-server');
      expect(result.token).toBe('mcp-token-value');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      delete process.env['MCP_TOKEN_TEST_SERVER'];
    });
  });

  describe('proxyAiRequest', () => {
    it('throws for unknown provider', async () => {
      await expect(service.proxyAiRequest('unknown', '/v1/chat', {}, {})).rejects.toThrow('Unknown AI provider');
    });

    it('throws when no API key configured', async () => {
      delete process.env['ANTHROPIC_API_KEY'];
      await expect(service.proxyAiRequest('anthropic', '/v1/messages', {}, {})).rejects.toThrow('No API key');
    });
  });
});
