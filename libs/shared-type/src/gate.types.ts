export type GateAction = 'approve' | 'reject' | 'request_changes';

export interface GateDecision {
  workflowId: string;
  action: GateAction;
  reviewer: string;
  comment?: string;
  timestamp: Date;
}
