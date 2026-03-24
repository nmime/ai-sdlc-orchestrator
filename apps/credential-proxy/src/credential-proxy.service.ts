import { Injectable } from '@nestjs/common';

@Injectable()
export class CredentialProxyService {
  async getGitCredential(tenantId: string, host: string): Promise<{ username: string; password: string }> {
    const envKey = `VCS_TOKEN_${tenantId.replace(/-/g, '_').toUpperCase()}`;
    const token = process.env[envKey] || process.env['DEFAULT_VCS_TOKEN'] || '';
    return { username: 'oauth2', password: token };
  }

  async getMcpToken(tenantId: string, serverName: string): Promise<{ token: string; expiresAt: string }> {
    const envKey = `MCP_TOKEN_${serverName.replace(/-/g, '_').toUpperCase()}`;
    const token = process.env[envKey] || '';
    return { token, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }

  async proxyAiRequest(
    provider: string,
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<Response> {
    const baseUrls: Record<string, string> = {
      anthropic: 'https://api.anthropic.com',
      openai: 'https://api.openai.com',
    };

    const baseUrl = baseUrls[provider];
    if (!baseUrl) throw new Error(`Unknown AI provider: ${provider}`);

    const apiKeyEnv = `${provider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnv];
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
