import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class JiraHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = body['webhookEvent'] as string;
    if (!eventType) return ResultUtils.ok(null);

    const issue = body['issue'] as Record<string, unknown> | undefined;
    if (!issue) return ResultUtils.ok(null);

    const fields = issue['fields'] as Record<string, unknown> || {};
    const labels = (fields['labels'] as string[]) || [];
    if (!labels.includes('ai-sdlc')) return ResultUtils.ok(null);

    const repoUrl = (fields['customfield_10100'] as string) || '';
    if (!repoUrl) return ResultUtils.err('VALIDATION_ERROR', 'No repo URL in Jira issue');

    const deliveryId = headers['x-atlassian-webhook-identifier'] || `jira-${issue['key']}-${Date.now()}`;

    return ResultUtils.ok({
      source: 'jira' as const,
      eventType,
      tenantId,
      deliveryId,
      taskId: issue['key'] as string,
      taskProvider: 'jira',
      repoUrl,
      labels,
      rawPayload: body,
    });
  }
}
