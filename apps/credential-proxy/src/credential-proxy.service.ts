import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_HOST = /^[a-zA-Z0-9._:-]+$/;

function validateId(value: string, name: string): void {
  if (!SAFE_ID.test(value)) {
    throw new BadRequestException(`Invalid ${name}`);
  }
}

function validateHost(value: string): void {
  if (!SAFE_HOST.test(value)) {
    throw new BadRequestException('Invalid host');
  }
}

@Injectable()
export class CredentialProxyService {
  constructor(private readonly configService: ConfigService) {}

  async getGitCredential(tenantId: string, host: string): Promise<{ username: string; password: string }> {
    validateId(tenantId, 'tenantId');
    validateHost(host);
    const envKey = `VCS_TOKEN_${tenantId.replace(/-/g, '_').toUpperCase()}`;
    const token = this.configService.get<string>(envKey) || this.configService.get<string>('DEFAULT_VCS_TOKEN') || '';
    return { username: 'oauth2', password: token };
  }

  async getMcpToken(tenantId: string, serverName: string): Promise<{ token: string; expiresAt: string }> {
    validateId(tenantId, 'tenantId');
    validateId(serverName, 'serverName');
    const envKey = `MCP_TOKEN_${serverName.replace(/-/g, '_').toUpperCase()}`;
    const token = this.configService.get<string>(envKey) || '';
    return { token, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }

  async proxyAiRequest(
    provider: string,
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<Response> {
    validateId(provider, 'provider');
    const baseUrls: Record<string, string> = {
      anthropic: 'https://api.anthropic.com',
      openai: 'https://api.openai.com',
    };

    const baseUrl = baseUrls[provider];
    if (!baseUrl) throw new Error(`Unknown AI provider: ${provider}`);

    const apiKeyEnv = `${provider.toUpperCase()}_API_KEY`;
    const apiKey = this.configService.get<string>(apiKeyEnv);
    if (!apiKey) throw new Error(`No API key configured for ${provider}`);

    const proxyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider === 'anthropic') {
      proxyHeaders['x-api-key'] = apiKey;
      proxyHeaders['anthropic-version'] = headers['anthropic-version'] || '2023-06-01';
    } else {
      proxyHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(body),
    });
  }
}
