import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class GitHubHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-github-event'] || 'issues';

    if (eventType === 'issues') {
      return this.parseIssue(body, tenantId);
    }

    if (eventType === 'check_run' || eventType === 'pull_request_review' || eventType === 'pull_request') {
      return this.parseCiOrReview(body, tenantId, eventType);
    }

    return ResultUtils.ok(null);
  }

  private parseIssue(body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const issue = body['issue'] as Record<string, unknown> || {};
    const labels = ((issue['labels'] as { name: string }[]) || []).map((l) => l.name);
    const repo = body['repository'] as Record<string, unknown> || {};

    if (!labels.includes('ai-sdlc')) {
      return ResultUtils.ok(null);
    }

    return ResultUtils.ok({
      source: 'github',
      eventType: 'issue',
      tenantId,
      idempotencyKey: `github-issue-${issue['id']}-${body['action']}`,
      taskExternalId: `#${issue['number']}`,
      taskTitle: issue['title'] as string || '',
      taskDescription: issue['body'] as string,
      repoUrl: repo['clone_url'] as string || '',
      labels,
      rawPayload: body,
    });
  }

  private parseCiOrReview(body: Record<string, unknown>, tenantId: string, eventType: string): Result<WebhookEvent | null, AppError> {
    const repo = body['repository'] as Record<string, unknown> || {};
    const attrs = (body['check_run'] || body['pull_request'] || body['review'] || {}) as Record<string, unknown>;

    return ResultUtils.ok({
      source: 'github',
      eventType,
      tenantId,
      idempotencyKey: `github-${eventType}-${attrs['id'] || Date.now()}-${body['action']}`,
      taskExternalId: `#${attrs['id'] || 'unknown'}`,
      taskTitle: (attrs['title'] || attrs['name'] || eventType) as string,
      repoUrl: repo['clone_url'] as string || '',
      rawPayload: body,
    });
  }
}
