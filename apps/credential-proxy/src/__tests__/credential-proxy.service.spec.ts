import { ConfigService } from '@nestjs/config';
import { CredentialProxyService } from '../credential-proxy.service';

function mockConfig(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

describe('CredentialProxyService', () => {
  it('returns tenant-specific VCS token', async () => {
    const svc = new CredentialProxyService(mockConfig({ VCS_TOKEN_ACME: 'tok-acme' }));
    const result = await svc.getGitCredential('acme', 'github.com');
    expect(result).toEqual({ username: 'oauth2', password: 'tok-acme' });
  });

  it('falls back to DEFAULT_VCS_TOKEN', async () => {
    const svc = new CredentialProxyService(mockConfig({ DEFAULT_VCS_TOKEN: 'fallback' }));
    const result = await svc.getGitCredential('unknown', 'github.com');
    expect(result).toEqual({ username: 'oauth2', password: 'fallback' });
  });

  it('returns empty password when no token configured', async () => {
    const svc = new CredentialProxyService(mockConfig());
    const result = await svc.getGitCredential('nope', 'github.com');
    expect(result.password).toBe('');
  });

  it('returns MCP token from config', async () => {
    const svc = new CredentialProxyService(mockConfig({ MCP_TOKEN_MYSERVER: 'mcp-123' }));
    const result = await svc.getMcpToken('tenant', 'myserver');
    expect(result.token).toBe('mcp-123');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns empty MCP token when not configured', async () => {
    const svc = new CredentialProxyService(mockConfig());
    const result = await svc.getMcpToken('tenant', 'unknown');
    expect(result.token).toBe('');
  });
});
