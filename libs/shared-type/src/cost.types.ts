export interface BudgetReservation {
  tenantId: string;
  workflowId: string;
  estimatedCostUsd: number;
  budgetVersionBefore: number;
  budgetVersionAfter: number;
}

export interface CostBreakdown {
  aiCostUsd: number;
  sandboxCostUsd: number;
  totalCostUsd: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  sandboxDurationSeconds: number;
}

export interface CostSettlement {
  tenantId: string;
  workflowId: string;
  reservedUsd: number;
  actualAiCostUsd: number;
  actualSandboxCostUsd: number;
  actualTotalCostUsd: number;
}
