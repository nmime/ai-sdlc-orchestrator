export interface AgentPromptData {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  repoUrl: string;
  branch: string;
  buildCommands?: string[];
  testCommands?: string[];
  lintCommands?: string[];
  mcpServers?: { name: string; endpoint: string }[];
  previousAttemptFeedback?: string;
  additionalContext?: string;
}

export interface AgentInvokeInput {
  sessionId: string;
  provider: string;
  prompt: string;
  sandboxId: string;
  maxDurationMs: number;
  maxCostUsd: number;
  credentialProxyUrl: string;
}

export interface AgentInvokeOutput {
  success: boolean;
  branchName?: string;
  mrUrl?: string;
  filesChanged: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  qualityScore?: number;
  artifacts: { type: string; name: string; url: string }[];
  errorMessage?: string;
}
