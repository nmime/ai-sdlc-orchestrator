export type WebhookSource = 'jira' | 'gitlab' | 'github' | 'linear';

export interface WebhookEvent {
  source: WebhookSource;
  eventType: string;
  tenantId: string;
  idempotencyKey: string;
  taskExternalId: string;
  taskTitle: string;
  taskDescription?: string;
  repoUrl: string;
  labels?: string[];
  assignee?: string;
  priority?: string;
  rawPayload: Record<string, unknown>;
}
