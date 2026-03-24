export const AGENT_PROVIDER = {
  CLAUDE: 'claude',
  OPENHANDS: 'openhands',
  AIDER: 'aider',
} as const;

export type AgentProvider = (typeof AGENT_PROVIDER)[keyof typeof AGENT_PROVIDER];

export const AGENT_RESULT_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  COST_LIMIT: 'cost_limit',
  TURN_LIMIT: 'turn_limit',
} as const;

export type AgentResultStatus = (typeof AGENT_RESULT_STATUS)[keyof typeof AGENT_RESULT_STATUS];

export const STATIC_ANALYSIS = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type StaticAnalysisValue = (typeof STATIC_ANALYSIS)[keyof typeof STATIC_ANALYSIS];

export interface AgentPromptData {
  taskSeed: string;
  repoInfo: {
    url: string;
    branch: string;
    defaultBranch: string;
    paths?: string[];
  };
  workflowInstructions: {
    qualityGates: string[];
    maxDiffLines?: number;
    allowedPaths?: string[];
    commitMessagePattern?: string;
    mrDescriptionTemplate?: string;
    staticAnalysisCommand?: string;
  };
  mcpServers: McpServerConfig[];
  previousContext?: import('./workflow.types').SessionContext;
}

export interface McpServerConfig {
  name: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

export interface AgentInvocation {
  workflowId: string;
  provider: AgentProvider;
  model?: string;
  repoPath: string;
  prompt: AgentPromptData;
  mcpServers: McpServerConfig[];
  costLimitUsd: number;
  maxTurns: number;
  previousSessionContext?: import('./workflow.types').SessionContext;
  staticAnalysisCommand?: string;
  sparseCheckoutPaths?: string[];
  workflowVariables?: Record<string, string>;
}

export interface AgentInvokeInput {
  sessionId: string;
  provider: string;
  prompt: string;
  sandboxId: string;
  maxDurationMs: number;
  maxCostUsd: number;
  credentialProxyUrl?: string;
  previousContext?: import('./workflow.types').SessionContext;
}

export interface AgentInvokeOutput {
  success: boolean;
  filesChanged: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  artifacts: import('./workflow.types').PublishedArtifact[];
  errorMessage?: string;
}

export interface AgentResult {
  sessionId: string;
  provider: AgentProvider;
  model: string;
  status: AgentResultStatus;
  errorCode?: string;
  errorMessage?: string;
  summary: string;
  branchName?: string;
  mrUrl?: string;
  mrDescription?: string;
  commitMessages?: string[];
  diffStats?: import('./workflow.types').DiffStats;
  artifacts?: import('./workflow.types').PublishedArtifact[];
  cost: {
    ai: { inputTokens: number; outputTokens: number; usd: number; provider: AgentProvider; model: string };
    sandbox: { durationSeconds: number; usd: number };
    totalUsd: number;
  };
  turnCount: number;
  toolCalls: { toolName: string; inputSummary?: Record<string, unknown>; outputSummary?: Record<string, unknown>; status: string; durationMs?: number }[];
  staticAnalysisResult?: StaticAnalysisValue;
  staticAnalysisOutput?: string;
}
