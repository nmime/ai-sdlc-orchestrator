import { Injectable } from '@nestjs/common';

@Injectable()
export class CredentialProxyService {
  async getGitCredential(tenantId: string, host: string): Promise<{ username: string; password: string }> {
    const tokenRef = process.env[`VCS_TOKEN_${tenantId.toUpperCase()}`] || process.env['DEFAULT_VCS_TOKEN'] || '';
    return { username: 'oauth2', password: tokenRef };
  }

  async getMcpToken(tenantId: string, serverName: string): Promise<{ token: string; expiresAt: string }> {
    const token = process.env[`MCP_TOKEN_${serverName.toUpperCase()}`] || '';
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    return { token, expiresAt };
  }
}
