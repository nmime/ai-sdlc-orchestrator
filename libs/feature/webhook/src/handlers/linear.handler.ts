import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class LinearHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const type = body['type'] as string;
    if (!type) return ResultUtils.ok(null);

    const action = body['action'] as string;
    if (type !== 'Issue' || !['create', 'update'].includes(action)) return ResultUtils.ok(null);

    const data = body['data'] as Record<string, unknown> || {};
    const labels = ((data['labels'] || data['labelIds']) as { name: string }[] || []).map(l => l.name ?? l);
    if (!labels.includes('ai-sdlc')) return ResultUtils.ok(null);

    const deliveryId = headers['linear-delivery'] || `linear-${data['id']}-${Date.now()}`;

    return ResultUtils.ok({
      source: 'linear' as const,
      eventType: `${type}.${action}`,
      tenantId,
      deliveryId,
      taskId: data['identifier'] as string || data['id'] as string,
      taskProvider: 'linear',
      repoUrl: '',
      labels,
      rawPayload: body,
    });
  }
}
