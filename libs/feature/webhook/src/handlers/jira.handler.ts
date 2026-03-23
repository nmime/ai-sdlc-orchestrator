import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class JiraHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-atlassian-webhook-identifier'] || 'jira:issue_updated';
    const issue = body['issue'] as Record<string, unknown> | undefined;

    if (!issue) {
      return ResultUtils.ok(null);
    }

    const fields = issue['fields'] as Record<string, unknown> || {};
    const labels = (fields['labels'] as string[]) || [];

    if (!labels.includes('ai-sdlc')) {
      return ResultUtils.ok(null);
    }

    return ResultUtils.ok({
      source: 'jira',
      eventType,
      tenantId,
      idempotencyKey: `jira-${issue['id']}-${body['timestamp'] || Date.now()}`,
      taskExternalId: issue['key'] as string,
      taskTitle: fields['summary'] as string || '',
      taskDescription: fields['description'] as string,
      repoUrl: (fields['customfield_10100'] as string) || '',
      labels,
      assignee: (fields['assignee'] as Record<string, unknown>)?.['displayName'] as string,
      rawPayload: body,
    });
  }
}
