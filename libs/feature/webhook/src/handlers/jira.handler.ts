import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import type { AppError } from '@app/common';
import { ResultUtils } from '@app/common';
import type { WebhookEvent } from '@app/shared-type';

export interface JiraFieldMapping {
  repoUrlField?: string;
}

@Injectable()
export class JiraHandler {
  private fieldMapping: JiraFieldMapping = {};

  setFieldMapping(mapping: JiraFieldMapping): void {
    this.fieldMapping = mapping;
  }

  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = body['webhookEvent'] as string;
    if (!eventType) return ResultUtils.ok(null);

    const issue = body['issue'] as Record<string, unknown> | undefined;
    if (!issue) return ResultUtils.ok(null);

    const fields = issue['fields'] as Record<string, unknown> || {};
    const labels = (fields['labels'] as string[]) || [];
    if (!labels.includes('ai-sdlc')) return ResultUtils.ok(null);

    const repoUrl = this.extractRepoUrl(fields);
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

  private extractRepoUrl(fields: Record<string, unknown>): string {
    if (this.fieldMapping.repoUrlField) {
      const value = fields[this.fieldMapping.repoUrlField] as string;
      if (value) return value;
    }

    const defaultFields = [
      'customfield_10100', 'customfield_10200', 'customfield_10300',
      'customfield_10400', 'customfield_10500',
    ];

    for (const fieldName of defaultFields) {
      const value = fields[fieldName] as string;
      if (value && (value.startsWith('https://') || value.startsWith('git@'))) return value;
    }

    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('customfield_') && typeof value === 'string') {
        if (value.startsWith('https://') && (value.includes('github.com') || value.includes('gitlab.com') || value.includes('bitbucket.org'))) {
          return value;
        }
      }
    }

    return '';
  }
}
