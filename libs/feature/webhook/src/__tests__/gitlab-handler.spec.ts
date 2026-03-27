import { GitLabHandler } from '../handlers/gitlab.handler';

describe('GitLabHandler', () => {
  const secret = 'gl-webhook-secret';
  const config = { get: vi.fn().mockReturnValue(secret) } as any;
  let handler: GitLabHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new GitLabHandler(config);
  });

  describe('verifySignature', () => {
    it('should accept valid token', () => {
      expect(() => handler.verifySignature({ 'x-gitlab-token': secret }, '', 'tenant-1')).not.toThrow();
    });

    it('should throw when secret not configured', () => {
      const h = new GitLabHandler({ get: vi.fn().mockReturnValue(undefined) } as any);
      expect(() => h.verifySignature({}, '', 'tenant-1')).toThrow('Webhook secret not configured');
    });

    it('should throw when token header is missing', () => {
      expect(() => handler.verifySignature({}, '', 'tenant-1')).toThrow('Missing webhook token');
    });

    it('should throw when token is invalid', () => {
      expect(() => handler.verifySignature({ 'x-gitlab-token': 'wrong' }, '', 'tenant-1')).toThrow('Invalid webhook token');
    });
  });

  describe('parse', () => {
    it('should return null when no event type', () => {
      const result = handler.parse({}, {}, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse Issue Hook with ai-sdlc label', () => {
      const headers = { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-event-uuid': 'uuid-1' };
      const body = {
        object_attributes: { iid: 10, labels: [{ title: 'ai-sdlc' }] },
        project: { git_http_url: 'https://gitlab.com/org/repo.git' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      const event = result._unsafeUnwrap()!;
      expect(event.source).toBe('gitlab');
      expect(event.taskId).toBe('#10');
      expect(event.repoUrl).toBe('https://gitlab.com/org/repo.git');
      expect(event.deliveryId).toBe('uuid-1');
    });

    it('should parse issue event via object_kind', () => {
      const headers = {};
      const body = {
        object_kind: 'issue',
        object_attributes: { iid: 5, labels: [{ title: 'ai-sdlc' }] },
        project: { web_url: 'https://gitlab.com/org/repo' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.source).toBe('gitlab');
    });

    it('should return null for issues without ai-sdlc label', () => {
      const headers = { 'x-gitlab-event': 'Issue Hook' };
      const body = {
        object_attributes: { iid: 5 },
        labels: [{ title: 'bug' }],
        project: {},
      };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse non-issue events (merge_request)', () => {
      const headers = { 'x-gitlab-event': 'Merge Request Hook' };
      const body = {
        object_attributes: { iid: 22 },
        project: { git_http_url: 'https://gitlab.com/org/repo.git' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      const event = result._unsafeUnwrap()!;
      expect(event.eventType).toBe('Merge Request Hook');
      expect(event.taskId).toBe('#22');
    });

    it('should use labels from body when not in object_attributes', () => {
      const headers = { 'x-gitlab-event': 'Issue Hook' };
      const body = {
        object_attributes: { iid: 7 },
        labels: [{ title: 'ai-sdlc' }],
        project: { web_url: 'https://gitlab.com/org/repo' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.labels).toContain('ai-sdlc');
    });

    it('should generate delivery ID when header is missing', () => {
      const headers = { 'x-gitlab-event': 'Push Hook' };
      const result = handler.parse(headers, { object_attributes: {}, project: {} }, 'tenant-1');
      expect(result._unsafeUnwrap()!.deliveryId).toMatch(/^gitlab-/);
    });

    it('should handle missing project data', () => {
      const headers = { 'x-gitlab-event': 'Push Hook' };
      const result = handler.parse(headers, { object_attributes: {} }, 'tenant-1');
      expect(result._unsafeUnwrap()!.repoUrl).toBe('');
    });
  });
});
