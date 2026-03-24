import { Injectable } from '@nestjs/common';
import type { AiAgentPort } from './ai-agent.port';

@Injectable()
export class AgentProviderRegistry {
  private readonly providers = new Map<string, AiAgentPort>();

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
}
