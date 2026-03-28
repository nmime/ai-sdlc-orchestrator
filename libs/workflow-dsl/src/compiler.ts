import { parse as parseYaml } from 'yaml';
import { Result } from 'neverthrow';
import { workflowDslSchema, type WorkflowDslConfig, type DslStep, type StepType, type Transition } from './schema';
import type { AppError } from '@app/common';
import { ResultUtils } from '@app/common';

export interface CompiledStep {
  id: string;
  type: StepType;
  action?: string;
  mode?: string;
  timeoutMs: number;
  gracefulShutdownMs: number;
  signal?: string;
  condition?: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
  onTimeout?: string;
  onExhausted?: string;
  onApproved?: string;
  onChangesRequested?: string;
  loopStrategy?: {
    maxIterations: number;
    noProgressLimit: number;
    regressionAction: string;
    escalationThreshold: number;
  };
  requireArtifacts?: { kind: string }[];
  reviewContext?: { artifacts: string[] };
  subtypes?: {
    recoverable?: { onUnblock?: string };
    terminal?: { cleanupTimeoutHours?: number };
  };
  childSteps?: CompiledStep[];
  branches?: CompiledBranch[];
  joinStrategy?: 'wait_all' | 'fail_fast';
  transitions?: CompiledTransition[];
  defaultTarget?: string;
  metadata?: Record<string, unknown>;
}

export interface CompiledBranch {
  id: string;
  steps: CompiledStep[];
}

export interface CompiledTransition {
  condition: string;
  target: string;
}

export interface CompiledWorkflow {
  name: string;
  version: number;
  taskQueue: string;
  timeoutMs: number;
  steps: CompiledStep[];
  stepMap: Record<string, CompiledStep>;
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
  variables?: Record<string, string>;
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
    const steps = config.steps.map((s) => this.compileStep(s));
    const stepMap: Record<string, CompiledStep> = {};
    this.flattenStepMap(steps, stepMap);

    return {
      name: config.name,
      version: config.version ?? 1,
      taskQueue: config.taskQueue,
      timeoutMs: (config.timeout_minutes ?? 240) * 60 * 1000,
      steps,
      stepMap,
      defaults: {
        agentProvider: config.defaults?.agentProvider ?? 'auto',
        sandboxProvider: config.defaults?.sandboxProvider ?? 'e2b',
        maxRetries: config.defaults?.maxRetries ?? 3,
        maxCostPerTaskUsd: config.defaults?.maxCostPerTaskUsd ?? 50,
      },
      hooks: config.hooks,
      variables: config.variables,
      checksum: this.computeChecksum(rawYaml),
      compiledAt: new Date().toISOString(),
    };
  }

  private compileStep(step: DslStep): CompiledStep {
    const compiled: CompiledStep = {
      id: step.id,
      type: step.type,
      action: step.action,
      mode: step.mode,
      timeoutMs: (step.timeout_minutes ?? 60) * 60 * 1000,
      gracefulShutdownMs: (step.graceful_shutdown_minutes ?? 5) * 60 * 1000,
      signal: step.signal,
      condition: step.condition,
      onSuccess: step.on_success,
      onFailure: step.on_failure,
      onTimeout: step.on_timeout,
      onExhausted: step.on_exhausted,
      onApproved: step.on_approved,
      onChangesRequested: step.on_changes_requested,
      requireArtifacts: step.require_artifacts,
      reviewContext: step.review_context,
      metadata: step.metadata,
    };

    if (step.loop_strategy) {
      compiled.loopStrategy = {
        maxIterations: step.loop_strategy.max_iterations,
        noProgressLimit: step.loop_strategy.no_progress_limit,
        regressionAction: step.loop_strategy.regression_action,
        escalationThreshold: step.loop_strategy.escalation_threshold,
      };
    }

    if (step.subtypes) {
      compiled.subtypes = {
        recoverable: step.subtypes.recoverable ? { onUnblock: step.subtypes.recoverable.on_unblock } : undefined,
        terminal: step.subtypes.terminal ? { cleanupTimeoutHours: step.subtypes.terminal.cleanup_timeout_hours } : undefined,
      };
    }

    if (step.steps) {
      compiled.childSteps = step.steps.map((s: DslStep) => this.compileStep(s));
    }

    if (step.branches) {
      compiled.branches = step.branches.map((b) => ({
        id: b.id,
        steps: b.steps.map((s: DslStep) => this.compileStep(s)),
      }));
      compiled.joinStrategy = step.join_strategy || 'wait_all';
    }

    if (step.transitions) {
      compiled.transitions = step.transitions.map((t: Transition) => ({
        condition: t.condition,
        target: t.target,
      }));
      compiled.defaultTarget = step.default_target;
    }

    return compiled;
  }

  private flattenStepMap(steps: CompiledStep[], map: Record<string, CompiledStep>): void {
    for (const step of steps) {
      map[step.id] = step;
      if (step.childSteps) this.flattenStepMap(step.childSteps, map);
      if (step.branches) {
        for (const branch of step.branches) {
          this.flattenStepMap(branch.steps, map);
        }
      }
    }
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
