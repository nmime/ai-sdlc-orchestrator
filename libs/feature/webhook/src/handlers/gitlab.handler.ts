import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class GitLabHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-gitlab-event'] || (body['object_kind'] as string);
    if (!eventType) return ResultUtils.ok(null);

    const deliveryId = headers['x-gitlab-event-uuid'] || `gitlab-${Date.now()}`;

    if (eventType === 'Issue Hook' || eventType === 'issue') {
      const attrs = body['object_attributes'] as Record<string, unknown> || {};
      const labels = ((attrs['labels'] || body['labels']) as { title: string }[] || []).map(l => l.title);
      if (!labels.includes('ai-sdlc')) return ResultUtils.ok(null);

      const project = body['project'] as Record<string, unknown> || {};
      const repoUrl = project['git_http_url'] as string || project['web_url'] as string || '';

      return ResultUtils.ok({
        source: 'gitlab' as const,
        eventType,
        tenantId,
        deliveryId,
        taskId: `#${attrs['iid']}`,
        taskProvider: 'gitlab',
        repoUrl,
        labels,
        rawPayload: body,
      });
    }

    const attrs = body['object_attributes'] as Record<string, unknown> || {};
    const project = body['project'] as Record<string, unknown> || {};
    const repoUrl = project['git_http_url'] as string || project['web_url'] as string || '';

    return ResultUtils.ok({
      source: 'gitlab' as const,
      eventType,
      tenantId,
      deliveryId,
      taskId: `#${attrs['iid'] || attrs['id'] || 'unknown'}`,
      taskProvider: 'gitlab',
      repoUrl,
      rawPayload: body,
    });
  }
}
