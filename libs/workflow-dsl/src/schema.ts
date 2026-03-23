import { z } from 'zod';

export const stepTypeSchema = z.enum([
  'auto',
  'signal_wait',
  'gate',
  'loop',
  'terminal',
  'recovery',
  'parallel',
  'conditional',
]);

export type StepType = z.infer<typeof stepTypeSchema>;

type DslStepInput = {
  name: string;
  type: StepType;
  description?: string;
  timeout?: string;
  retries?: number;
  condition?: string;
  signal?: string;
  maxIterations?: number;
  noProgressThreshold?: number;
  escalation?: 'continue' | 'fail' | 'gate';
  steps?: DslStepInput[];
  onFailure?: 'fail' | 'skip' | 'retry' | 'recovery';
  recoveryStep?: string;
  metadata?: Record<string, unknown>;
};

export const dslStepSchema: z.ZodType<DslStepInput> = z.object({
  name: z.string().min(1).max(100),
  type: stepTypeSchema,
  description: z.string().optional(),
  timeout: z.string().regex(/^\d+[smhd]$/).default('30m'),
  retries: z.number().int().min(0).max(10).default(0),
  condition: z.string().optional(),
  signal: z.string().optional(),
  maxIterations: z.number().int().min(1).max(50).optional(),
  noProgressThreshold: z.number().int().min(1).max(10).default(3),
  escalation: z.enum(['continue', 'fail', 'gate']).default('fail'),
  steps: z.lazy(() => z.array(dslStepSchema)).optional(),
  onFailure: z.enum(['fail', 'skip', 'retry', 'recovery']).default('fail'),
  recoveryStep: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type DslStep = z.infer<typeof dslStepSchema>;

export const workflowDslSchema = z.object({
  version: z.literal('1.0'),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  taskQueue: z.string().default('orchestrator-queue'),
  timeout: z.string().regex(/^\d+[smhd]$/).default('4h'),
  steps: z.array(dslStepSchema).min(1),
  defaults: z.object({
    agentProvider: z.string().default('claude_code'),
    sandboxProvider: z.string().default('e2b'),
    maxRetries: z.number().int().default(3),
    maxCostPerTaskUsd: z.number().default(50),
  }).optional(),
  hooks: z.object({
    onStart: z.string().optional(),
    onComplete: z.string().optional(),
    onFailure: z.string().optional(),
  }).optional(),
});

export type WorkflowDslConfig = z.infer<typeof workflowDslSchema>;
