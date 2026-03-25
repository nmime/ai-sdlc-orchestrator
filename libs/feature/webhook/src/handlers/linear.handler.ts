import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import type { AppError } from '@app/common';
import { ResultUtils } from '@app/common';
import type { WebhookEvent } from '@app/shared-type';
import { TenantRepoConfig } from '@app/db';

@Injectable()
export class LinearHandler {
  constructor(private readonly em: EntityManager) {}

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

  async resolveRepoUrl(tenantId: string, body: Record<string, unknown>): Promise<string> {
    const data = body['data'] as Record<string, unknown> || {};
    const labels = ((data['labels'] || data['labelIds']) as { name: string }[] || []).map(l => l.name ?? l);
    const description = (data['description'] as string) || '';

    const repoUrlMatch = description.match(/repo:\s*(https?:\/\/[^\s]+\.git)/i)
      || description.match(/(https?:\/\/(?:github\.com|gitlab\.com)\/[^\s]+)/i);
    if (repoUrlMatch?.[1]) return repoUrlMatch[1];

    const configs = await this.em.find(TenantRepoConfig, { tenant: tenantId });
    if (configs.length === 1) return configs[0].repoUrl;

    for (const config of configs) {
      const repoName = config.repoId.toLowerCase();
      if (labels.some(l => l.toLowerCase().includes(repoName))) return config.repoUrl;
    }

    if (configs.length > 0) return configs[0].repoUrl;
    return '';
  }
}
