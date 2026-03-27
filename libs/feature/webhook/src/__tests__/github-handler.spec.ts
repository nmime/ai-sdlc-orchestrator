import { createHmac } from 'crypto';
import { GitHubHandler } from '../handlers/github.handler';

describe('GitHubHandler', () => {
  const secret = 'test-webhook-secret';
  const config = { get: vi.fn().mockReturnValue(secret) } as any;
  let handler: GitHubHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new GitHubHandler(config);
  });

  describe('verifySignature', () => {
    it('should accept valid signature', () => {
      const body = '{"action":"opened"}';
      const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
      expect(() => handler.verifySignature({ 'x-hub-signature-256': sig }, body, 'tenant-1')).not.toThrow();
    });

    it('should throw when secret not configured', () => {
      const cfgNoSecret = { get: vi.fn().mockReturnValue(undefined) } as any;
      const h = new GitHubHandler(cfgNoSecret);
      expect(() => h.verifySignature({}, 'body', 'tenant-1')).toThrow('Webhook secret not configured');
    });

    it('should throw when signature header is missing', () => {
      expect(() => handler.verifySignature({}, 'body', 'tenant-1')).toThrow('Missing webhook signature');
    });

    it('should throw when signature is invalid', () => {
      expect(() => handler.verifySignature({ 'x-hub-signature-256': 'sha256=bad' }, 'body', 'tenant-1')).toThrow('Invalid webhook signature');
    });
  });

  describe('parse', () => {
    it('should return null when no x-github-event header', () => {
      const result = handler.parse({}, {}, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse issues event with ai-sdlc label', () => {
      const headers = { 'x-github-event': 'issues', 'x-github-delivery': 'del-1' };
      const body = {
        issue: { number: 42, labels: [{ name: 'ai-sdlc' }, { name: 'bug' }] },
        repository: { clone_url: 'https://github.com/org/repo.git', html_url: 'https://github.com/org/repo' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      const event = result._unsafeUnwrap()!;
      expect(event.source).toBe('github');
      expect(event.taskId).toBe('#42');
      expect(event.repoUrl).toBe('https://github.com/org/repo.git');
      expect(event.labels).toContain('ai-sdlc');
      expect(event.deliveryId).toBe('del-1');
    });

    it('should return null for issues without ai-sdlc label', () => {
      const headers = { 'x-github-event': 'issues' };
      const body = { issue: { number: 1, labels: [{ name: 'bug' }] }, repository: {} };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should handle issues with missing labels', () => {
      const headers = { 'x-github-event': 'issues' };
      const body = { issue: { number: 1 }, repository: {} };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse non-issue events (pull_request)', () => {
      const headers = { 'x-github-event': 'pull_request' };
      const body = { pull_request: { id: 99 }, repository: { html_url: 'https://github.com/org/repo' } };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      const event = result._unsafeUnwrap()!;
      expect(event.source).toBe('github');
      expect(event.eventType).toBe('pull_request');
      expect(event.taskId).toBe('#99');
    });

    it('should parse check_run events', () => {
      const headers = { 'x-github-event': 'check_run' };
      const body = { check_run: { id: 55 }, repository: { clone_url: 'https://github.com/org/repo.git' } };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()!.taskId).toBe('#55');
    });

    it('should generate delivery ID when header missing', () => {
      const headers = { 'x-github-event': 'push' };
      const result = handler.parse(headers, { repository: {} }, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()!.deliveryId).toMatch(/^github-/);
    });

    it('should handle missing repository data', () => {
      const headers = { 'x-github-event': 'push' };
      const result = handler.parse(headers, {}, 'tenant-1');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()!.repoUrl).toBe('');
    });

    it('should use html_url as fallback for repo URL', () => {
      const headers = { 'x-github-event': 'issues', 'x-github-delivery': 'del-1' };
      const body = {
        issue: { number: 1, labels: [{ name: 'ai-sdlc' }] },
        repository: { html_url: 'https://github.com/org/repo' },
      };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.repoUrl).toBe('https://github.com/org/repo');
    });
  });
});
