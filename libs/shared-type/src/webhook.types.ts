export type WebhookSource = 'jira' | 'gitlab' | 'github' | 'linear';

export interface WebhookEvent {
  source: WebhookSource;
  eventType: string;
  tenantId: string;
  deliveryId: string;
  taskId: string;
  taskProvider: string;
  repoUrl: string;
  labels?: string[];
  assignee?: string;
  priority?: string;
  rawPayload: Record<string, unknown>;
}
