export interface BudgetReservation {
  tenantId: string;
  taskId: string;
  reservedUsd: number;
  budgetVersionBefore: number;
  budgetVersionAfter: number;
}

export interface CostBreakdown {
  aiCostUsd: number;
  sandboxCostUsd: number;
  totalCostUsd: number;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  sandboxDurationMs: number;
}
