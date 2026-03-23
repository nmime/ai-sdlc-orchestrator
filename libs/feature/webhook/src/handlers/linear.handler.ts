import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import { ResultUtils } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class LinearHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const type = body['type'] as string;
    const action = body['action'] as string;

    if (type !== 'Issue' || (action !== 'create' && action !== 'update')) {
      return ResultUtils.ok(null);
    }

    const data = body['data'] as Record<string, unknown> || {};
    const labels = ((data['labels'] as { name: string }[]) || []).map((l) => l.name);

    if (!labels.includes('ai-sdlc')) {
      return ResultUtils.ok(null);
    }

    const team = data['team'] as Record<string, unknown> || {};

    return ResultUtils.ok({
      source: 'linear',
      eventType: `issue.${action}`,
      tenantId,
      idempotencyKey: `linear-${data['id']}-${body['updatedFrom'] || Date.now()}`,
      taskExternalId: data['identifier'] as string || data['id'] as string,
      taskTitle: data['title'] as string || '',
      taskDescription: data['description'] as string,
      repoUrl: (team['key'] as string) || '',
      labels,
      priority: data['priority'] as string,
      rawPayload: body,
    });
  }
}
