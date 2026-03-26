import { CredentialProxyController } from '../credential-proxy.controller';
import { CredentialProxyService } from '../credential-proxy.service';
import { SessionService } from '../session.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

function mockConfig(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

describe('CredentialProxyController', () => {
  let controller: CredentialProxyController;
  let sessionService: SessionService;
  let credentialService: CredentialProxyService;

  beforeEach(() => {
    const config = mockConfig({ VCS_TOKEN_ACME: 'tok', MCP_TOKEN_SRV: 'mcp-tok', SESSION_SIGNING_KEY: 'key' });
    credentialService = new CredentialProxyService(config);
    sessionService = new SessionService(config);
    controller = new CredentialProxyController(credentialService, sessionService);
  });

  it('creates and uses a session for git-credential', async () => {
    const { token } = await controller.createSession({ tenantId: 'acme', workflowId: 'wf', sessionId: 's1' });
    const result = await controller.getGitCredential(`Bearer ${token}`, { host: 'github.com' });
    expect(result.password).toBe('tok');
  });

  it('throws on missing auth header', async () => {
    await expect(controller.getGitCredential('', { host: 'github.com' })).rejects.toThrow(UnauthorizedException);
  });

  it('throws on invalid token', async () => {
    await expect(controller.getGitCredential('Bearer bad.token', { host: 'github.com' })).rejects.toThrow(UnauthorizedException);
  });

  it('revokes session', async () => {
    const { token } = await controller.createSession({ tenantId: 'acme', workflowId: 'wf', sessionId: 's2' });
    await controller.revokeSession('s2');
    await expect(controller.getGitCredential(`Bearer ${token}`, { host: 'github.com' })).rejects.toThrow(UnauthorizedException);
  });

  it('returns health', () => {
    const h = controller.health();
    expect(h.status).toBe('ok');
    expect(h.timestamp).toBeTruthy();
  });
});
