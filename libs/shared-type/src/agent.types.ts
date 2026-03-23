export type AgentProvider = 'claude' | 'openhands' | 'aider';

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

export interface AgentResult {
  sessionId: string;
  provider: AgentProvider;
  model: string;
  status: 'success' | 'failure' | 'cost_limit' | 'turn_limit';
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
  staticAnalysisResult?: 'passed' | 'failed' | 'skipped';
  staticAnalysisOutput?: string;
}
