import { Injectable } from '@nestjs/common';
import type { AiAgentPort } from './ai-agent.port';

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
  private systemDefaultProvider = 'claude_code';
  private systemDefaultModel = 'claude-sonnet-4-20250514';

  register(provider: AiAgentPort): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): AiAgentPort | undefined {
    return this.providers.get(name);
  }

  getOrThrow(name: string): AiAgentPort {
    const provider = this.providers.get(name);
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
    const model = this.resolveModel(input, providerName);
    return { provider, providerName, model };
  }

  private resolveModel(input: ProviderResolutionInput, _providerName: string): string {
    if (input.taskLabel && input.repoModelRouting?.[input.taskLabel]) {
      const routed = input.repoModelRouting[input.taskLabel];
      if (routed) return routed;
    }
    return input.repoAgentModel || input.tenantDefaultModel || this.systemDefaultModel;
  }
}
