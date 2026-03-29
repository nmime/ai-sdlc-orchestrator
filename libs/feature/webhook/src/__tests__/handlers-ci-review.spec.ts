import { describe, it, expect } from 'vitest';
import { GitHubHandler } from '../handlers/github.handler';
import { GitLabHandler } from '../handlers/gitlab.handler';
import { JiraHandler } from '../handlers/jira.handler';
import { LinearHandler } from '../handlers/linear.handler';

describe('GitHubHandler CI/Review events', () => {
  const handler = new GitHubHandler();

  describe('parseCiEvent', () => {
    it('parses check_suite success', () => {
      const result = handler.parseCiEvent(
        { 'x-github-event': 'check_suite' },
        {
          action: 'completed',
          check_suite: {
            conclusion: 'success',
            head_branch: 'feature/ai-task-42',
            head_sha: 'abc123',
            id: 12345,
          },
          repository: { full_name: 'org/repo', clone_url: 'https://github.com/org/repo.git' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_succeeded');
      expect(result!.branchName).toBe('feature/ai-task-42');
      expect(result!.pipelineId).toBe('12345');
    });

    it('parses check_suite failure', () => {
      const result = handler.parseCiEvent(
        { 'x-github-event': 'check_suite' },
        {
          action: 'completed',
          check_suite: { conclusion: 'failure', head_branch: 'fix/bug', id: 999 },
          repository: { clone_url: '' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_failed');
    });

    it('parses workflow_run success', () => {
      const result = handler.parseCiEvent(
        { 'x-github-event': 'workflow_run' },
        {
          action: 'completed',
          workflow_run: { conclusion: 'success', head_branch: 'main', name: 'CI', id: 789 },
          repository: { clone_url: 'https://github.com/org/repo.git' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_succeeded');
      expect(result!.details).toContain('CI');
    });

    it('parses workflow_run failure', () => {
      const result = handler.parseCiEvent(
        { 'x-github-event': 'workflow_run' },
        {
          action: 'completed',
          workflow_run: { conclusion: 'failure', head_branch: 'dev', name: 'Tests', id: 101 },
          repository: { clone_url: '' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_failed');
    });

    it('returns null for non-CI events', () => {
      expect(handler.parseCiEvent({ 'x-github-event': 'push' }, {})).toBeNull();
    });

    it('returns null for in-progress check_suite (no conclusion)', () => {
      const result = handler.parseCiEvent(
        { 'x-github-event': 'check_suite' },
        { action: 'requested', check_suite: { conclusion: null, head_branch: 'x' } },
      );
      expect(result).toBeNull();
    });
  });

  describe('parseReviewEvent', () => {
    it('parses approved review', () => {
      const result = handler.parseReviewEvent(
        { 'x-github-event': 'pull_request_review' },
        {
          action: 'submitted',
          review: { state: 'approved', user: { login: 'reviewer1' }, body: 'LGTM' },
          pull_request: { head: { ref: 'feature/ai-task-42' }, number: 7 },
          repository: { clone_url: 'https://github.com/org/repo.git' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('approved');
      expect(result!.reviewer).toBe('reviewer1');
      expect(result!.branchName).toBe('feature/ai-task-42');
      expect(result!.mrId).toBe('7');
    });

    it('parses changes_requested review with comment', () => {
      const result = handler.parseReviewEvent(
        { 'x-github-event': 'pull_request_review' },
        {
          action: 'submitted',
          review: { state: 'changes_requested', user: { login: 'lead-dev' }, body: 'Fix the error handling' },
          pull_request: { head: { ref: 'feature/improve-api' }, number: 12 },
          repository: { clone_url: '' },
        },
      );
      expect(result).toBeTruthy();
      expect(result!.type).toBe('changes_requested');
      expect(result!.comment).toBe('Fix the error handling');
      expect(result!.reviewer).toBe('lead-dev');
    });

    it('returns null for non-review events', () => {
      expect(handler.parseReviewEvent({ 'x-github-event': 'push' }, {})).toBeNull();
    });

    it('returns null for commented review (not approved/changes_requested)', () => {
      const result = handler.parseReviewEvent(
        { 'x-github-event': 'pull_request_review' },
        {
          action: 'submitted',
          review: { state: 'commented', user: { login: 'bot' }, body: 'nit' },
          pull_request: { head: { ref: 'main' }, number: 1 },
          repository: { clone_url: '' },
        },
      );
      expect(result).toBeNull();
    });
  });
});

describe('GitLabHandler CI/Review events', () => {
  const handler = new GitLabHandler();

  describe('parseCiEvent', () => {
    it('parses pipeline success', () => {
      const result = handler.parseCiEvent({
        object_kind: 'pipeline',
        object_attributes: { status: 'success', ref: 'feature/work', id: 555 },
        project: { path_with_namespace: 'org/repo', git_http_url: 'https://gitlab.com/org/repo.git' },
      });
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_succeeded');
      expect(result!.branchName).toBe('feature/work');
    });

    it('parses pipeline failure', () => {
      const result = handler.parseCiEvent({
        object_kind: 'pipeline',
        object_attributes: { status: 'failed', ref: 'fix/broken', id: 666 },
        project: { git_http_url: '' },
      });
      expect(result).toBeTruthy();
      expect(result!.type).toBe('pipeline_failed');
    });

    it('returns null for running pipeline', () => {
      const result = handler.parseCiEvent({
        object_kind: 'pipeline',
        object_attributes: { status: 'running', ref: 'main' },
      });
      expect(result).toBeNull();
    });

    it('returns null for non-pipeline events', () => {
      expect(handler.parseCiEvent({ object_kind: 'push' })).toBeNull();
    });
  });

  describe('parseReviewEvent', () => {
    it('parses MR approved', () => {
      const result = handler.parseReviewEvent({
        object_kind: 'merge_request',
        object_attributes: { action: 'approved', source_branch: 'feature/task-1', iid: 5 },
        user: { username: 'reviewer' },
        project: { git_http_url: 'https://gitlab.com/org/repo.git' },
      });
      expect(result).toBeTruthy();
      expect(result!.type).toBe('approved');
      expect(result!.branchName).toBe('feature/task-1');
      expect(result!.reviewer).toBe('reviewer');
    });

    it('returns null for non-MR events', () => {
      expect(handler.parseReviewEvent({ object_kind: 'push' })).toBeNull();
    });

    it('returns null for non-approved MR actions', () => {
      const result = handler.parseReviewEvent({
        object_kind: 'merge_request',
        object_attributes: { action: 'update', source_branch: 'x', iid: 1 },
        user: { username: 'u' },
        project: { git_http_url: '' },
      });
      expect(result).toBeNull();
    });
  });
});

describe('JiraHandler repo URL extraction', () => {
  const handler = new JiraHandler();

  it('extracts repo URL from custom field scan', () => {
    const result = handler.parse({}, {
      webhookEvent: 'jira:issue_updated',
      issue: {
        key: 'PROJ-42',
        fields: {
          summary: 'Do the thing',
          labels: ['opwerf'],
          project: { key: 'PROJ' },
          customfield_10100: 'https://github.com/org/repo.git',
        },
      },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeTruthy();
      expect(result.value!.repoUrl).toBe('https://github.com/org/repo.git');
    }
  });

  it('returns Ok(null) for issues without opwerf label', () => {
    const result = handler.parse({}, {
      webhookEvent: 'jira:issue_updated',
      issue: {
        key: 'PROJ-1',
        fields: { summary: 'No label', labels: ['other'], project: { key: 'PROJ' } },
      },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it('returns Ok(null) for missing issue', () => {
    const result = handler.parse({}, { webhookEvent: 'jira:issue_created' }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });
});

describe('LinearHandler real parsing', () => {
  const em = { find: async () => [] } as any;
  const handler = new LinearHandler(em);

  it('parses issue update with repo URL in description', () => {
    const result = handler.parse({}, {
      type: 'Issue',
      action: 'update',
      data: {
        id: 'lin-1',
        identifier: 'ENG-42',
        title: 'Implement feature',
        description: 'Details here. repo: https://github.com/org/repo.git more text',
        labels: [{ name: 'opwerf' }],
        team: { key: 'ENG' },
      },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeTruthy();
      expect(result.value!.source).toBe('linear');
    }
  });

  it('returns Ok(null) when no opwerf label', () => {
    const result = handler.parse({}, {
      type: 'Issue',
      action: 'update',
      data: {
        id: 'lin-2',
        identifier: 'ENG-1',
        title: 'Other',
        description: '',
        labels: [{ name: 'bug' }],
        team: { key: 'ENG' },
      },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it('returns Ok(null) for non-Issue type', () => {
    const result = handler.parse({}, {
      type: 'Comment',
      action: 'create',
      data: { labels: [] },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it('returns Ok(null) for Issue with wrong action', () => {
    const result = handler.parse({}, {
      type: 'Issue',
      action: 'remove',
      data: { labels: [{ name: 'opwerf' }] },
    }, 'test-tenant');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });
});
