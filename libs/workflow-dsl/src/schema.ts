import { z } from 'zod';

export const loopStrategySchema = z.object({
  max_iterations: z.number().int().min(1).max(50),
  no_progress_limit: z.number().int().min(1).max(10).default(2),
  regression_action: z.enum(['stop', 'continue', 'retry_once']).default('stop'),
  escalation_threshold: z.number().int().min(1).default(3),
});

export type LoopStrategy = z.infer<typeof loopStrategySchema>;

export const STEP_TYPES = ['auto', 'signal_wait', 'gate', 'loop', 'terminal', 'recovery', 'parallel', 'conditional'] as const;

export const stepTypeSchema = z.enum(STEP_TYPES);

export type StepType = z.infer<typeof stepTypeSchema>;

export const transitionSchema = z.object({
  condition: z.string(),
  target: z.string(),
});

export type Transition = z.infer<typeof transitionSchema>;

export const parallelBranchSchema = z.object({
  id: z.string(),
  steps: z.array(z.lazy(() => dslStepSchema)),
});

export type ParallelBranch = z.infer<typeof parallelBranchSchema>;

const baseDslStepSchema = z.object({
  id: z.string().min(1).max(100),
  type: stepTypeSchema,
  action: z.string().optional(),
  mode: z.enum(['implement', 'ci_fix', 'review_fix']).optional(),
  description: z.string().optional(),
  timeout_minutes: z.number().int().min(1).default(60),
  graceful_shutdown_minutes: z.number().int().min(1).default(5),
  signal: z.string().optional(),
  condition: z.record(z.unknown()).optional(),
  on_success: z.string().optional(),
  on_failure: z.string().optional(),
  on_timeout: z.string().optional(),
  on_exhausted: z.string().optional(),
  on_approved: z.string().optional(),
  on_changes_requested: z.string().optional(),
  loop_strategy: loopStrategySchema.optional(),
  require_artifacts: z.array(z.object({ kind: z.string() })).optional(),
  review_context: z.object({ artifacts: z.array(z.string()) }).optional(),
  subtypes: z.object({
    recoverable: z.object({ on_unblock: z.string().optional() }).optional(),
    terminal: z.object({ cleanup_timeout_hours: z.number().optional() }).optional(),
  }).optional(),
  steps: z.array(z.lazy(() => dslStepSchema)).optional(),
  branches: z.array(parallelBranchSchema).optional(),
  join_strategy: z.enum(['wait_all', 'fail_fast']).optional(),
  transitions: z.array(transitionSchema).optional(),
  default_target: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const dslStepSchema: z.ZodType<DslStep, z.ZodTypeDef, unknown> = z.lazy(() => baseDslStepSchema);

export interface DslStep {
  id: string;
  type: StepType;
  action?: string;
  mode?: 'implement' | 'ci_fix' | 'review_fix';
  description?: string;
  timeout_minutes: number;
  graceful_shutdown_minutes: number;
  signal?: string;
  condition?: Record<string, unknown>;
  on_success?: string;
  on_failure?: string;
  on_timeout?: string;
  on_exhausted?: string;
  on_approved?: string;
  on_changes_requested?: string;
  loop_strategy?: LoopStrategy;
  require_artifacts?: { kind: string }[];
  review_context?: { artifacts: string[] };
  subtypes?: {
    recoverable?: { on_unblock?: string };
    terminal?: { cleanup_timeout_hours?: number };
  };
  steps?: DslStep[];
  branches?: ParallelBranch[];
  join_strategy?: 'wait_all' | 'fail_fast';
  transitions?: Transition[];
  default_target?: string;
  metadata?: Record<string, unknown>;
}

export const workflowDslSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.number().int().min(1),
  description: z.string().optional(),
  taskQueue: z.string().default('orchestrator-queue'),
  timeout_minutes: z.number().int().min(1).default(240),
  steps: z.array(dslStepSchema).min(1),
  defaults: z.object({
    agentProvider: z.string().optional(),
    sandboxProvider: z.string().default('e2b'),
    maxRetries: z.number().int().default(3),
    maxCostPerTaskUsd: z.number().default(50),
  }).optional(),
  hooks: z.object({
    onStart: z.string().optional(),
    onComplete: z.string().optional(),
    onFailure: z.string().optional(),
  }).optional(),
  variables: z.record(z.string()).optional(),
});

export type WorkflowDslConfig = z.infer<typeof workflowDslSchema>;
