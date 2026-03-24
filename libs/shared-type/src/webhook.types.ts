export const WEBHOOK_SOURCE = {
  JIRA: 'jira',
  GITLAB: 'gitlab',
  GITHUB: 'github',
  LINEAR: 'linear',
} as const;

export type WebhookSource = (typeof WEBHOOK_SOURCE)[keyof typeof WEBHOOK_SOURCE];

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
