import { parse as parseYaml } from 'yaml';
import { Result } from 'neverthrow';
import { workflowDslSchema, type WorkflowDslConfig } from './schema';
import type { AppError } from '@ai-sdlc/common/result/app-error';
import { ResultUtils } from '@ai-sdlc/common/result/result.utils';

export interface CompiledStep {
  name: string;
  type: string;
  timeoutMs: number;
  retries: number;
  condition?: string;
  signal?: string;
  maxIterations?: number;
  noProgressThreshold?: number;
  escalation?: string;
  childSteps?: CompiledStep[];
  onFailure?: string;
  recoveryStep?: string;
  metadata?: Record<string, unknown>;
}

export interface CompiledWorkflow {
  name: string;
  taskQueue: string;
  timeoutMs: number;
  steps: CompiledStep[];
  defaults: {
    agentProvider: string;
    sandboxProvider: string;
    maxRetries: number;
    maxCostPerTaskUsd: number;
  };
  hooks?: {
    onStart?: string;
    onComplete?: string;
    onFailure?: string;
  };
  checksum: string;
  compiledAt: string;
}

export class DslCompiler {
  compile(yamlContent: string): Result<CompiledWorkflow, AppError> {
    let parsed: unknown;
    try {
      parsed = parseYaml(yamlContent);
    } catch (e) {
      return ResultUtils.err('VALIDATION_ERROR', `Invalid YAML: ${(e as Error).message}`);
    }

    const validation = workflowDslSchema.safeParse(parsed);
    if (!validation.success) {
      return ResultUtils.err('VALIDATION_ERROR', 'DSL validation failed', {
        errors: validation.error.errors,
      });
    }

    const config = validation.data;
    return ResultUtils.ok(this.compileConfig(config, yamlContent));
  }

  private compileConfig(config: WorkflowDslConfig, rawYaml: string): CompiledWorkflow {
    return {
      name: config.name,
      taskQueue: config.taskQueue,
      timeoutMs: this.parseDuration(config.timeout),
      steps: config.steps.map((s) => this.compileStep(s)),
      defaults: {
        agentProvider: config.defaults?.agentProvider ?? 'claude_code',
        sandboxProvider: config.defaults?.sandboxProvider ?? 'e2b',
        maxRetries: config.defaults?.maxRetries ?? 3,
        maxCostPerTaskUsd: config.defaults?.maxCostPerTaskUsd ?? 50,
      },
      hooks: config.hooks,
      checksum: this.computeChecksum(rawYaml),
      compiledAt: new Date().toISOString(),
    };
  }

  private compileStep(step: Record<string, any>): CompiledStep {
    return {
      name: step.name,
      type: step.type,
      timeoutMs: this.parseDuration(step.timeout || '30m'),
      retries: step.retries ?? 0,
      condition: step.condition,
      signal: step.signal,
      maxIterations: step.maxIterations,
      noProgressThreshold: step.noProgressThreshold,
      escalation: step.escalation,
      childSteps: step.steps?.map((s: any) => this.compileStep(s)),
      onFailure: step.onFailure,
      recoveryStep: step.recoveryStep,
      metadata: step.metadata,
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? 60 * 1000);
  }

  private computeChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(36);
  }
}
