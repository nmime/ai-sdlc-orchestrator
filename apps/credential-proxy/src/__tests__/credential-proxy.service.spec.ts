import { ConfigService } from '@nestjs/config';
import { CredentialProxyService } from '../credential-proxy.service';

describe('CredentialProxyService', () => {
  let service: CredentialProxyService;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConfigService = { get: vi.fn().mockReturnValue(undefined) };
    service = new CredentialProxyService(mockConfigService as unknown as ConfigService);
  });

  describe('getGitCredential', () => {
    it('returns oauth2 username with env token', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'VCS_TOKEN_TEST_TENANT') return 'test-token-123';
        return undefined;
      });
      const result = await service.getGitCredential('test-tenant', 'github.com');
      expect(result.username).toBe('oauth2');
      expect(result.password).toBe('test-token-123');
    });

    it('falls back to DEFAULT_VCS_TOKEN', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DEFAULT_VCS_TOKEN') return 'default-token';
        return undefined;
      });
      const result = await service.getGitCredential('unknown-tenant', 'github.com');
      expect(result.password).toBe('default-token');
    });

    it('returns empty password when no token configured', async () => {
      const result = await service.getGitCredential('no-token-tenant', 'github.com');
      expect(result.password).toBe('');
    });
  });

  describe('getMcpToken', () => {
    it('returns token from config', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MCP_TOKEN_TEST_SERVER') return 'mcp-token-value';
        return undefined;
      });
      const result = await service.getMcpToken('tenant-1', 'test-server');
      expect(result.token).toBe('mcp-token-value');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('proxyAiRequest', () => {
    it('throws for unknown provider', async () => {
      await expect(service.proxyAiRequest('unknown', '/v1/chat', {}, {})).rejects.toThrow('Unknown AI provider');
    });

    it('throws when no API key configured', async () => {
      await expect(service.proxyAiRequest('anthropic', '/v1/messages', {}, {})).rejects.toThrow('No API key');
    });
  });
});
