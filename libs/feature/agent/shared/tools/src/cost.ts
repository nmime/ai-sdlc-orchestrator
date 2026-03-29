export interface CostConfig {
  inputCostPer1M: number;
  outputCostPer1M: number;
  sandboxCostPerHourUsd: number;
}

export const DEFAULT_COST_CONFIG: CostConfig = {
  inputCostPer1M: 3.0,
  outputCostPer1M: 15.0,
  sandboxCostPerHourUsd: 0.05,
};

export function calculateAiCost(inputTokens: number, outputTokens: number, config: CostConfig = DEFAULT_COST_CONFIG): number {
  return (inputTokens * config.inputCostPer1M + outputTokens * config.outputCostPer1M) / 1_000_000;
}

export function calculateSandboxCost(durationMs: number, costPerHourUsd: number = DEFAULT_COST_CONFIG.sandboxCostPerHourUsd): number {
  return (durationMs / 3_600_000) * costPerHourUsd;
}
