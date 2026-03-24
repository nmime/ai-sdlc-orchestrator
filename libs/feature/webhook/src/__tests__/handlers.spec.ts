import { JiraHandler } from '../handlers/jira.handler';
import { GitHubHandler } from '../handlers/github.handler';
import { GitLabHandler } from '../handlers/gitlab.handler';
import { LinearHandler } from '../handlers/linear.handler';

describe('JiraHandler', () => {
  const handler = new JiraHandler();

  it('should parse a valid Jira webhook with ai-sdlc label', () => {
    const result = handler.parse(
      { 'x-atlassian-webhook-identifier': 'delivery-123' },
      {
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-123',
          fields: {
            summary: 'Fix the login bug',
            description: 'Login fails on mobile',
            labels: ['ai-sdlc', 'bug'],
            customfield_10100: 'https://github.com/org/repo.git',
            assignee: { displayName: 'John' },
            priority: { name: 'High' },
          },
        },
      },
      'tenant-1',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).not.toBeNull();
      expect(result.value!.source).toBe('jira');
      expect(result.value!.taskId).toBe('PROJ-123');
      expect(result.value!.repoUrl).toBe('https://github.com/org/repo.git');
      expect(result.value!.tenantId).toBe('tenant-1');
      expect(result.value!.deliveryId).toBe('delivery-123');
    }
  });

  it('should return null for issues without ai-sdlc label', () => {
    const result = handler.parse(
      {},
      {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'PROJ-124', fields: { summary: 'Test', labels: ['bug'] } },
      },
      'tenant-1',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it('should return null for payload without webhookEvent', () => {
    const result = handler.parse({}, { type: 'other' }, 'tenant-1');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });
});

describe('GitHubHandler', () => {
  const handler = new GitHubHandler();

  it('should parse a GitHub issue with ai-sdlc label', () => {
    const result = handler.parse(
      { 'x-github-event': 'issues', 'x-github-delivery': 'gh-del-1' },
      {
        action: 'labeled',
        issue: {
          id: 123,
          number: 42,
          title: 'Add dark mode',
          body: 'We need dark mode support',
          labels: [{ name: 'ai-sdlc' }, { name: 'feature' }],
        },
        repository: { clone_url: 'https://github.com/org/repo.git' },
      },
      'tenant-2',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value!.source).toBe('github');
      expect(result.value!.taskId).toBe('#42');
      expect(result.value!.eventType).toBe('issues');
    }
  });

  it('should ignore GitHub issues without ai-sdlc label', () => {
    const result = handler.parse(
      { 'x-github-event': 'issues' },
      {
        action: 'opened',
        issue: { id: 456, number: 43, title: 'Test', labels: [{ name: 'bug' }] },
        repository: {},
      },
      'tenant-2',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });

  it('should parse CI events (check_run)', () => {
    const result = handler.parse(
      { 'x-github-event': 'check_run' },
      {
        action: 'completed',
        check_run: { id: 789, name: 'CI Tests' },
        repository: { clone_url: 'https://github.com/org/repo.git' },
      },
      'tenant-2',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value!.eventType).toBe('check_run');
    }
  });

  it('should return null for unsupported events', () => {
    const result = handler.parse({ 'x-github-event': 'star' }, {}, 'tenant-2');
    expect(result.isOk()).toBe(true);
  });
});

describe('GitLabHandler', () => {
  const handler = new GitLabHandler();

  it('should parse a GitLab issue with ai-sdlc label', () => {
    const result = handler.parse(
      { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-event-uuid': 'gl-uuid-1' },
      {
        object_attributes: {
          iid: 10,
          title: 'Refactor auth module',
          description: 'Need to refactor',
          updated_at: '2024-01-01T00:00:00Z',
        },
        labels: [{ title: 'ai-sdlc' }],
        project: { git_http_url: 'https://gitlab.com/org/repo.git' },
      },
      'tenant-3',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value!.source).toBe('gitlab');
      expect(result.value!.taskId).toBe('#10');
    }
  });

  it('should ignore GitLab issues without ai-sdlc label', () => {
    const result = handler.parse(
      { 'x-gitlab-event': 'Issue Hook' },
      {
        object_attributes: { iid: 11, title: 'Test' },
        labels: [{ title: 'bug' }],
        project: {},
      },
      'tenant-3',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });
});

describe('LinearHandler', () => {
  const handler = new LinearHandler();

  it('should parse a Linear issue with ai-sdlc label', () => {
    const result = handler.parse(
      { 'linear-delivery': 'lin-del-1' },
      {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'lin-123',
          identifier: 'ENG-42',
          title: 'Implement SSO',
          description: 'Need SSO support',
          labels: [{ name: 'ai-sdlc' }],
          team: { key: 'ENG' },
        },
        updatedFrom: { labelIds: [] },
      },
      'tenant-4',
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value!.source).toBe('linear');
      expect(result.value!.taskId).toBe('ENG-42');
    }
  });

  it('should ignore non-Issue types', () => {
    const result = handler.parse({}, { type: 'Comment', action: 'create' }, 'tenant-4');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBeNull();
  });
});
