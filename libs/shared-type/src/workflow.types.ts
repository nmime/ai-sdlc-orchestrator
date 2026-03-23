export interface WorkflowInput {
  tenantId: string;
  taskExternalId: string;
  taskTitle: string;
  taskDescription?: string;
  repoUrl: string;
  webhookDeliveryId: string;
  dslId?: string;
  priority?: number;
}

export interface StepResult {
  stepName: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  costUsd: number;
  output?: Record<string, unknown>;
  errorMessage?: string;
}

export interface WorkflowResult {
  success: boolean;
  steps: StepResult[];
  totalCostUsd: number;
  mrUrl?: string;
  artifacts: { type: string; name: string; url: string }[];
  errorMessage?: string;
}
