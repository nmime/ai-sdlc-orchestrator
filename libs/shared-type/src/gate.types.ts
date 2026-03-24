export type GateAction = 'approve' | 'request_changes';

export interface GateDecision {
  workflowId: string;
  gateId: string;
  action: GateAction;
  reviewer: string;
  comment?: string;
  timestamp: Date;
}
