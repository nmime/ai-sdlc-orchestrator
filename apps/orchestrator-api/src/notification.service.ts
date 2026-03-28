import { Injectable } from '@nestjs/common';
import { PinoLoggerService, isInternalUrl, sanitizeLog } from '@app/common';
import { CostAlert } from '@app/db';

export interface NotificationChannel {
  type: 'webhook' | 'email';
  url?: string;
  address?: string;
}

@Injectable()
export class NotificationService {
  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('NotificationService');
  }

  async sendAlert(alert: CostAlert, channels: NotificationChannel[]): Promise<void> {
    for (const channel of channels) {
      if (channel.type === 'webhook' && channel.url) {
        if (isInternalUrl(channel.url)) {
          this.logger.warn(`Blocked internal URL in notification channel`);
          continue;
        }
        try {
          await fetch(channel.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'cost_alert',
              alertType: alert.alertType,
              thresholdPct: alert.thresholdPct,
              actualUsd: alert.actualUsd,
              limitUsd: alert.limitUsd,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(10_000),
          });
          this.logger.log(`Alert sent to webhook`);
        } catch (error) {
          this.logger.error(`Failed to send webhook alert: ${sanitizeLog((error as Error).message)}`);
        }
      }
    }
  }

  async sendWorkflowNotification(
    eventType: string,
    workflowId: string,
    channels: NotificationChannel[],
    details?: Record<string, unknown>,
  ): Promise<void> {
    for (const channel of channels) {
      if (channel.type === 'webhook' && channel.url) {
        if (isInternalUrl(channel.url)) {
          this.logger.warn(`Blocked internal URL in notification channel`);
          continue;
        }
        try {
          await fetch(channel.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'workflow_event', eventType, workflowId, ...details, timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(10_000),
          });
        } catch (error) {
          this.logger.error(`Failed to send workflow notification: ${sanitizeLog((error as Error).message)}`);
        }
      }
    }
  }
}
