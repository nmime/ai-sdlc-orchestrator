import { createHmac } from 'crypto';
import { JiraHandler } from '../handlers/jira.handler';

describe('JiraHandler', () => {
  const secret = 'jira-webhook-secret';
  const config = { get: vi.fn().mockReturnValue(secret) } as any;
  let handler: JiraHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new JiraHandler(config);
  });

  describe('verifySignature', () => {
    it('should accept valid signature', () => {
      const body = '{"webhookEvent":"jira:issue_updated"}';
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      expect(() => handler.verifySignature({ 'x-hub-signature': sig }, body, 'tenant-1')).not.toThrow();
    });

    it('should throw when secret not configured', () => {
      const h = new JiraHandler({ get: vi.fn().mockReturnValue(undefined) } as any);
      expect(() => h.verifySignature({}, 'body', 'tenant-1')).toThrow('Webhook secret not configured');
    });

    it('should throw when signature header is missing', () => {
      expect(() => handler.verifySignature({}, 'body', 'tenant-1')).toThrow('Missing webhook signature');
    });

    it('should throw when signature is invalid', () => {
      expect(() => handler.verifySignature({ 'x-hub-signature': 'bad' }, 'body', 'tenant-1')).toThrow('Invalid webhook signature');
    });
  });

  describe('parse', () => {
    it('should return null when no webhookEvent', () => {
      const result = handler.parse({}, {}, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should return null when no issue in body', () => {
      const result = handler.parse({}, { webhookEvent: 'jira:issue_updated' }, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should return null for issues without ai-sdlc label', () => {
      const body = {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'PROJ-1', fields: { labels: ['bug'], customfield_10100: 'https://github.com/org/repo' } },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse issue with ai-sdlc label and repo URL', () => {
      const body = {
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-42',
          fields: { labels: ['ai-sdlc'], customfield_10100: 'https://github.com/org/repo.git' },
        },
      };
      const headers = { 'x-atlassian-webhook-identifier': 'atl-del-1' };
      const result = handler.parse(headers, body, 'tenant-1');
      expect(result.isOk()).toBe(true);
      const event = result._unsafeUnwrap()!;
      expect(event.source).toBe('jira');
      expect(event.taskId).toBe('PROJ-42');
      expect(event.repoUrl).toBe('https://github.com/org/repo.git');
      expect(event.deliveryId).toBe('atl-del-1');
    });

    it('should return VALIDATION_ERROR when repo URL is missing', () => {
      const body = {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'PROJ-1', fields: { labels: ['ai-sdlc'] } },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_ERROR');
      expect(result._unsafeUnwrapErr().message).toContain('No repo URL');
    });

    it('should generate delivery ID when header is missing', () => {
      const body = {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'PROJ-5', fields: { labels: ['ai-sdlc'], customfield_10100: 'https://github.com/org/repo' } },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.deliveryId).toMatch(/^jira-PROJ-5-/);
    });

    it('should handle issue with missing fields', () => {
      const body = {
        webhookEvent: 'jira:issue_updated',
        issue: { key: 'PROJ-1' },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });
  });
});
