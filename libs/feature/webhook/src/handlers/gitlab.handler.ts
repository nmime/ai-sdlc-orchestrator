import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class GitLabHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-gitlab-event'] || 'Issue Hook';

    if (eventType === 'Issue Hook') {
      return this.parseIssue(body, tenantId);
    }

    if (eventType === 'Pipeline Hook' || eventType === 'Merge Request Hook' || eventType === 'Note Hook') {
      return this.parseCiOrReview(body, tenantId, eventType);
    }

    return ResultUtils.ok(null);
  }

  private parseIssue(body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const attrs = body['object_attributes'] as Record<string, unknown> || {};
    const labels = ((body['labels'] as { title: string }[]) || []).map((l) => l.title);

    if (!labels.includes('ai-sdlc')) {
      return ResultUtils.ok(null);
    }

    const project = body['project'] as Record<string, unknown> || {};

    return ResultUtils.ok({
      source: 'gitlab',
      eventType: 'issue',
      tenantId,
      idempotencyKey: `gitlab-issue-${attrs['iid']}-${attrs['updated_at']}`,
      taskExternalId: `#${attrs['iid']}`,
      taskTitle: attrs['title'] as string || '',
      taskDescription: attrs['description'] as string,
      repoUrl: project['git_http_url'] as string || '',
      labels,
      rawPayload: body,
    });
  }

  private parseCiOrReview(body: Record<string, unknown>, tenantId: string, eventType: string): Result<WebhookEvent | null, AppError> {
    const attrs = body['object_attributes'] as Record<string, unknown> || {};
    const project = body['project'] as Record<string, unknown> || {};

    return ResultUtils.ok({
      source: 'gitlab',
      eventType,
      tenantId,
      idempotencyKey: `gitlab-${eventType}-${attrs['iid'] || attrs['id']}-${attrs['updated_at'] || Date.now()}`,
      taskExternalId: `#${attrs['iid'] || attrs['id']}`,
      taskTitle: attrs['title'] as string || eventType,
      repoUrl: project['git_http_url'] as string || '',
      rawPayload: body,
    });
  }
}
