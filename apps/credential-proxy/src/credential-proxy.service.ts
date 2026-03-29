import { Injectable, BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

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

export interface AiProviderConfig {
  baseUrl: string;
  authType: 'api-key-header' | 'bearer';
  authHeader?: string;
  extraHeaders?: Record<string, string>;
}

const DEFAULT_PROVIDER_CONFIGS: Record<string, AiProviderConfig> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    authType: 'api-key-header',
    authHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    authType: 'bearer',
  },
};

@Injectable()
export class CredentialProxyService {
  private providerConfigs: Map<string, AiProviderConfig>;

  constructor(private readonly configService: ConfigService) {
    this.providerConfigs = new Map(Object.entries(DEFAULT_PROVIDER_CONFIGS));
    this.loadProviderConfigs();
  }

  private loadProviderConfigs(): void {
    const configJson = this.configService.get<string>('AI_PROVIDER_CONFIGS');
    if (configJson) {
      try {
        const configs = JSON.parse(configJson) as Record<string, AiProviderConfig>;
        for (const [name, config] of Object.entries(configs)) {
          this.providerConfigs.set(name, config);
        }
      } catch {
        // ignore invalid JSON, use defaults
      }
    }
  }

  registerProvider(name: string, config: AiProviderConfig): void {
    this.providerConfigs.set(name, config);
  }

  listProviders(): string[] {
    return [...this.providerConfigs.keys()];
  }

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
    tenantApiKeys?: Record<string, string>,
  ): Promise<Response> {
    validateId(provider, 'provider');

    const providerConfig = this.resolveProviderConfig(provider);
    const apiKey = this.resolveApiKey(provider, tenantApiKeys);

    const proxyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (providerConfig.authType === 'api-key-header') {
      proxyHeaders[providerConfig.authHeader || 'x-api-key'] = apiKey;
    } else {
      proxyHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    if (providerConfig.extraHeaders) {
      for (const [key, defaultValue] of Object.entries(providerConfig.extraHeaders)) {
        proxyHeaders[key] = headers[key] || defaultValue;
      }
    }

    return fetch(`${providerConfig.baseUrl}${path}`, {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(body),
    });
  }

  private resolveProviderConfig(provider: string): AiProviderConfig {
    const envBaseUrl = this.configService.get<string>(`AI_BASE_URL_${provider.toUpperCase()}`);
    const registered = this.providerConfigs.get(provider);

    if (envBaseUrl) {
      return {
        ...(registered || { authType: 'bearer' as const }),
        baseUrl: envBaseUrl,
      };
    }

    if (registered) return registered;

    throw new Error(`Unknown AI provider: ${provider}. Available: ${this.listProviders().join(', ')}. Configure via AI_PROVIDER_CONFIGS env or registerProvider().`);
  }

  private resolveApiKey(provider: string, tenantApiKeys?: Record<string, string>): string {
    if (tenantApiKeys?.[provider]) return tenantApiKeys[provider];

    const apiKey = this.configService.get<string>(`${provider.toUpperCase()}_API_KEY`);
    if (!apiKey) throw new Error(`No API key configured for ${provider}. Set ${provider.toUpperCase()}_API_KEY env var or configure tenant-level keys.`);
    return apiKey;
  }
}
