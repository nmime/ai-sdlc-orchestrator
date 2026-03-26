import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class GitHubHandler {
  constructor(private readonly config: ConfigService) {}

  verifySignature(headers: Record<string, string>, rawBody: string, tenantId: string): void {
    const secret = this.config.get<string>(`WEBHOOK_SECRET_GITHUB_${tenantId.toUpperCase()}`);
    if (!secret) return;
    const signature = headers['x-hub-signature-256'];
    if (!signature) throw new UnauthorizedException('Missing webhook signature');
    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-github-event'];
    if (!eventType) return ResultUtils.ok(null);

    const deliveryId = headers['x-github-delivery'] || `github-${Date.now()}`;

    if (eventType === 'issues') {
      const issue = body['issue'] as Record<string, unknown> || {};
      const labels = (issue['labels'] as { name: string }[] || []).map(l => l.name);
      if (!labels.includes('ai-sdlc')) return ResultUtils.ok(null);

      const repo = body['repository'] as Record<string, unknown> || {};
      const repoUrl = repo['clone_url'] as string || repo['html_url'] as string || '';

      return ResultUtils.ok({
        source: 'github' as const,
        eventType,
        tenantId,
        deliveryId,
        taskId: `#${issue['number']}`,
        taskProvider: 'github',
        repoUrl,
        labels,
        rawPayload: body,
      });
    }

    const repo = body['repository'] as Record<string, unknown> || {};
    const repoUrl = repo['clone_url'] as string || repo['html_url'] as string || '';
    const attrs = body['check_run'] || body['pull_request'] || body as Record<string, unknown>;

    return ResultUtils.ok({
      source: 'github' as const,
      eventType,
      tenantId,
      deliveryId,
      taskId: `#${(attrs as Record<string, unknown>)['id'] || 'unknown'}`,
      taskProvider: 'github',
      repoUrl,
      rawPayload: body,
    });
  }
}
