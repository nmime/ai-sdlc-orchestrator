import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiAgentPort } from './ai-agent.port';
import type { AppConfig } from '@app/common';

export interface ProviderResolutionInput {
  repoAgentProvider?: string;
  repoAgentModel?: string;
  repoModelRouting?: Record<string, string>;
  tenantDefaultProvider?: string;
  tenantDefaultModel?: string;
  taskLabel?: string;
}

@Injectable()
export class AgentProviderRegistry {
  private readonly providers = new Map<string, AiAgentPort>();
  private systemDefaultProvider: string;
  private systemDefaultModel: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.systemDefaultProvider = this.configService.get('DEFAULT_AGENT_PROVIDER') || 'auto';
    this.systemDefaultModel = this.configService.get('DEFAULT_AGENT_MODEL') || '';
  }

  register(provider: AiAgentPort): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): AiAgentPort | undefined {
    if (name === 'auto') return this.resolveAuto();
    return this.providers.get(name);
  }

  getOrThrow(name: string): AiAgentPort {
    const provider = this.get(name);
    if (!provider) {
      throw new Error(`Agent provider '${name}' not registered. Available: ${[...this.providers.keys()].join(', ')}`);
    }
    return provider;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  resolveProvider(input: ProviderResolutionInput): { provider: AiAgentPort; providerName: string; model: string } {
    const providerName = input.repoAgentProvider || input.tenantDefaultProvider || this.systemDefaultProvider;
    const provider = this.getOrThrow(providerName);
    const model = this.resolveModel(input);
    return { provider, providerName: provider.name, model };
  }

  private resolveAuto(): AiAgentPort | undefined {
    const first = this.providers.values().next();
    return first.done ? undefined : first.value;
  }

  private resolveModel(input: ProviderResolutionInput): string {
    if (input.taskLabel && input.repoModelRouting?.[input.taskLabel]) {
      const routed = input.repoModelRouting[input.taskLabel];
      if (routed) return routed;
    }
    return input.repoAgentModel || input.tenantDefaultModel || this.systemDefaultModel;
  }
}
