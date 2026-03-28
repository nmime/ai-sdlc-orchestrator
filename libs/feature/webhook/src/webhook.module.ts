import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { JiraHandler } from './handlers/jira.handler';
import { GitLabHandler } from './handlers/gitlab.handler';
import { GitHubHandler } from './handlers/github.handler';
import { LinearHandler } from './handlers/linear.handler';
import { WebhookRetryService } from './webhook-retry.service';
import { PollingService } from './polling/polling.service';

@Module({
  controllers: [WebhookController],
  providers: [
    WebhookService, WebhookSignatureService,
    JiraHandler, GitLabHandler, GitHubHandler, LinearHandler,
    WebhookRetryService, PollingService,
  ],
  exports: [WebhookService, WebhookSignatureService, WebhookRetryService, PollingService],
})
export class WebhookModule {}
