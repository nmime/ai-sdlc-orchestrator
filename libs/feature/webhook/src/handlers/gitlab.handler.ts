import { Injectable } from '@nestjs/common';
import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import { ResultUtils } from '@ai-sdlc/common';
import type { WebhookEvent } from '@ai-sdlc/shared-type';

export interface CiSignal {
  type: 'pipeline_succeeded' | 'pipeline_failed';
  repoUrl: string;
  branchName: string;
  details: string;
  pipelineId: string;
}

export interface ReviewSignal {
  type: 'approved' | 'changes_requested';
  repoUrl: string;
  branchName: string;
  mrId: string;
  reviewer: string;
  comment?: string;
}

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

  parseCiEvent(body: Record<string, unknown>): CiSignal | null {
    const objectKind = body['object_kind'] as string;
    if (objectKind !== 'pipeline') return null;

    const attrs = body['object_attributes'] as Record<string, unknown> || {};
    const status = attrs['status'] as string;
    const ref = attrs['ref'] as string;
    const project = body['project'] as Record<string, unknown> || {};
    const repoUrl = project['git_http_url'] as string || '';

    if (status === 'success') {
      return {
        type: 'pipeline_succeeded',
        repoUrl,
        branchName: ref,
        details: `Pipeline ${attrs['id']} succeeded`,
        pipelineId: String(attrs['id']),
      };
    } else if (status === 'failed') {
      return {
        type: 'pipeline_failed',
        repoUrl,
        branchName: ref,
        details: `Pipeline ${attrs['id']} failed`,
        pipelineId: String(attrs['id']),
      };
    }
    return null;
  }

  parseReviewEvent(body: Record<string, unknown>): ReviewSignal | null {
    const objectKind = body['object_kind'] as string;
    if (objectKind !== 'merge_request') return null;

    const attrs = body['object_attributes'] as Record<string, unknown> || {};
    const action = attrs['action'] as string;
    const project = body['project'] as Record<string, unknown> || {};
    const repoUrl = project['git_http_url'] as string || '';
    const sourceBranch = attrs['source_branch'] as string;
    const mrIid = String(attrs['iid']);
    const user = body['user'] as Record<string, unknown> || {};

    if (action === 'approved') {
      return {
        type: 'approved',
        repoUrl,
        branchName: sourceBranch,
        mrId: mrIid,
        reviewer: user['username'] as string || 'unknown',
      };
    }

    const noteKind = body["object_kind"] as string; if (noteKind === "note") {
      const noteableType = body['object_attributes'] as Record<string, unknown> || {};
      if (noteableType['noteable_type'] === 'MergeRequest') {
        const mr = body['merge_request'] as Record<string, unknown> || {};
        return {
          type: 'changes_requested',
          repoUrl,
          branchName: mr['source_branch'] as string || '',
          mrId: String(mr['iid']),
          reviewer: user['username'] as string || 'unknown',
          comment: attrs['note'] as string,
        };
      }
    }

    return null;
  }
}
