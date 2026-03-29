import { Injectable } from '@nestjs/common';
import type { Result } from 'neverthrow';
import type { AppError } from '@app/common';
import { ResultUtils } from '@app/common';
import type { WebhookEvent } from '@app/shared-type';
import type { CiSignal, ReviewSignal } from './gitlab.handler';

@Injectable()
export class GitHubHandler {
  parse(headers: Record<string, string>, body: Record<string, unknown>, tenantId: string): Result<WebhookEvent | null, AppError> {
    const eventType = headers['x-github-event'];
    if (!eventType) return ResultUtils.ok(null);

    const deliveryId = headers['x-github-delivery'] || `github-${Date.now()}`;

    if (eventType === 'issues') {
      const issue = body['issue'] as Record<string, unknown> || {};
      const labels = (issue['labels'] as { name: string }[] || []).map(l => l.name);
      if (!labels.includes('opwerf')) return ResultUtils.ok(null);

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

  parseCiEvent(headers: Record<string, string>, body: Record<string, unknown>): CiSignal | null {
    const eventType = headers['x-github-event'];

    if (eventType === 'check_suite') {
      const suite = body['check_suite'] as Record<string, unknown> || {};
      const conclusion = suite['conclusion'] as string;
      const headBranch = suite['head_branch'] as string;
      const repo = body['repository'] as Record<string, unknown> || {};
      const repoUrl = repo['clone_url'] as string || '';

      if (conclusion === 'success') {
        return { type: 'pipeline_succeeded', repoUrl, branchName: headBranch, details: `Check suite passed`, pipelineId: String(suite['id']) };
      } else if (conclusion === 'failure') {
        return { type: 'pipeline_failed', repoUrl, branchName: headBranch, details: `Check suite failed`, pipelineId: String(suite['id']) };
      }
    }

    if (eventType === 'workflow_run') {
      const run = body['workflow_run'] as Record<string, unknown> || {};
      const conclusion = run['conclusion'] as string;
      const headBranch = run['head_branch'] as string;
      const repo = body['repository'] as Record<string, unknown> || {};
      const repoUrl = repo['clone_url'] as string || '';

      if (conclusion === 'success') {
        return { type: 'pipeline_succeeded', repoUrl, branchName: headBranch, details: `Workflow run ${run['name']} succeeded`, pipelineId: String(run['id']) };
      } else if (conclusion === 'failure') {
        return { type: 'pipeline_failed', repoUrl, branchName: headBranch, details: `Workflow run ${run['name']} failed`, pipelineId: String(run['id']) };
      }
    }

    return null;
  }

  parseReviewEvent(headers: Record<string, string>, body: Record<string, unknown>): ReviewSignal | null {
    const eventType = headers['x-github-event'];

    if (eventType === 'pull_request_review') {
      const review = body['review'] as Record<string, unknown> || {};
      const pr = body['pull_request'] as Record<string, unknown> || {};
      const state = review['state'] as string;
      const headRef = (pr['head'] as Record<string, unknown>)?.['ref'] as string;
      const repo = body['repository'] as Record<string, unknown> || {};
      const repoUrl = repo['clone_url'] as string || '';
      const reviewer = (review['user'] as Record<string, unknown>)?.['login'] as string || 'unknown';

      if (state === 'approved') {
        return { type: 'approved', repoUrl, branchName: headRef, mrId: String(pr['number']), reviewer };
      } else if (state === 'changes_requested') {
        return { type: 'changes_requested', repoUrl, branchName: headRef, mrId: String(pr['number']), reviewer, comment: review['body'] as string };
      }
    }

    return null;
  }
}
