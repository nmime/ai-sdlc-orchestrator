import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CredentialProxyService {
  constructor(private readonly config: ConfigService) {}

  async getGitCredential(tenantId: string, host: string): Promise<{ username: string; password: string }> {
    const tokenRef = this.config.get<string>(`VCS_TOKEN_${tenantId.toUpperCase()}`) || this.config.get<string>('DEFAULT_VCS_TOKEN') || '';
    return { username: 'oauth2', password: tokenRef };
  }

  async getMcpToken(tenantId: string, serverName: string): Promise<{ token: string; expiresAt: string }> {
    const token = this.config.get<string>(`MCP_TOKEN_${serverName.toUpperCase()}`) || '';
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    return { token, expiresAt };
  }
}
