import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { JiraHandler } from './handlers/jira.handler';
import { GitLabHandler } from './handlers/gitlab.handler';
import { GitHubHandler } from './handlers/github.handler';
import { LinearHandler } from './handlers/linear.handler';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, JiraHandler, GitLabHandler, GitHubHandler, LinearHandler],
  exports: [WebhookService],
})
export class WebhookModule {}
