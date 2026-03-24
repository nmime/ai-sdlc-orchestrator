export interface WorkflowInput {
  tenantId: string;
  taskId: string;
  taskProvider: string;
  repoId: string;
  repoUrl: string;
  webhookDeliveryId: string;
  dslName?: string;
  dslVersion?: number;
  priority?: number;
  labels?: string[];
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
  aiCostUsd: number;
  sandboxCostUsd: number;
  mrUrl?: string;
  branchName?: string;
  artifacts: PublishedArtifact[];
  errorMessage?: string;
}

export interface PublishedArtifact {
  kind: string;
  title: string;
  uri: string;
  status: 'draft' | 'published';
  mimeType?: string;
  metadata?: Record<string, unknown>;
  content?: string;
  previewUrl?: string;
}

export interface SessionContext {
  summary: string;
  filesModified: string[];
  testOutputSnippet?: string;
  toolCallsSummary: string[];
  errorCode?: string;
  branchName: string;
  mrUrl?: string;
}

export interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  filesChanged: string[];
}
