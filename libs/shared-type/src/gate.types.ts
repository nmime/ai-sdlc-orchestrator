export const GATE_ACTION = {
  APPROVE: 'approve',
  REQUEST_CHANGES: 'request_changes',
} as const;

export type GateAction = (typeof GATE_ACTION)[keyof typeof GATE_ACTION];

export interface GateDecision {
  workflowId: string;
  gateId: string;
  action: GateAction;
  reviewer: string;
  comment?: string;
  timestamp: Date;
}
