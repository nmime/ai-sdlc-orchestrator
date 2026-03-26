import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

@Injectable()
export class JiraHandler {
  constructor(private readonly config: ConfigService) {}

  verifySignature(headers: Record<string, string>, rawBody: string, tenantId: string): void {
    const secret = this.config.get<string>(`WEBHOOK_SECRET_JIRA_${tenantId.toUpperCase()}`);
    if (!secret) return;
    const signature = headers['x-hub-signature'];
    if (!signature) throw new UnauthorizedException('Missing webhook signature');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

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
