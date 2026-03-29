export const STEP_RESULT_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type StepResultStatus = (typeof STEP_RESULT_STATUS)[keyof typeof STEP_RESULT_STATUS];

export const ARTIFACT_PUB_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type ArtifactPubStatus = (typeof ARTIFACT_PUB_STATUS)[keyof typeof ARTIFACT_PUB_STATUS];

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
  status: StepResultStatus;
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
  filePath?: string;
  status: ArtifactPubStatus;
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
