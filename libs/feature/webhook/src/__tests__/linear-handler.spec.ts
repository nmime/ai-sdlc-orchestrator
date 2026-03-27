import { createHmac } from 'crypto';
import { LinearHandler } from '../handlers/linear.handler';

describe('LinearHandler', () => {
  const secret = 'linear-webhook-secret';
  const config = { get: vi.fn().mockReturnValue(secret) } as any;
  let handler: LinearHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new LinearHandler(config);
  });

  describe('verifySignature', () => {
    it('should accept valid signature', () => {
      const body = '{"type":"Issue"}';
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      expect(() => handler.verifySignature({ 'linear-signature': sig }, body, 'tenant-1')).not.toThrow();
    });

    it('should throw when secret not configured', () => {
      const h = new LinearHandler({ get: vi.fn().mockReturnValue(undefined) } as any);
      expect(() => h.verifySignature({}, 'body', 'tenant-1')).toThrow('Webhook secret not configured');
    });

    it('should throw when signature header is missing', () => {
      expect(() => handler.verifySignature({}, 'body', 'tenant-1')).toThrow('Missing webhook signature');
    });

    it('should throw when signature is invalid', () => {
      expect(() => handler.verifySignature({ 'linear-signature': 'bad' }, 'body', 'tenant-1')).toThrow('Invalid webhook signature');
    });
  });

  describe('parse', () => {
    it('should return null when no type field', () => {
      const result = handler.parse({}, {}, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should return null for non-Issue types', () => {
      const result = handler.parse({}, { type: 'Comment', action: 'create' }, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should return null for Issue with non-create/update action', () => {
      const result = handler.parse({}, { type: 'Issue', action: 'delete' }, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should return null for Issue without ai-sdlc label', () => {
      const body = {
        type: 'Issue',
        action: 'create',
        data: { id: 'lin-1', identifier: 'LIN-42', labels: [{ name: 'bug' }] },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should parse Issue create event with ai-sdlc label', () => {
      const body = {
        type: 'Issue',
        action: 'create',
        data: { id: 'lin-1', identifier: 'LIN-42', labels: [{ name: 'ai-sdlc' }] },
      };
      const headers = { 'linear-delivery': 'lin-del-1' };
      const result = handler.parse(headers, body, 'tenant-1');
      const event = result._unsafeUnwrap()!;
      expect(event.source).toBe('linear');
      expect(event.eventType).toBe('Issue.create');
      expect(event.taskId).toBe('LIN-42');
      expect(event.deliveryId).toBe('lin-del-1');
    });

    it('should parse Issue update event', () => {
      const body = {
        type: 'Issue',
        action: 'update',
        data: { id: 'lin-2', identifier: 'LIN-99', labels: [{ name: 'ai-sdlc' }] },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.eventType).toBe('Issue.update');
    });

    it('should generate delivery ID when header is missing', () => {
      const body = {
        type: 'Issue',
        action: 'create',
        data: { id: 'lin-3', labels: [{ name: 'ai-sdlc' }] },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.deliveryId).toMatch(/^linear-lin-3-/);
    });

    it('should fallback to data.id when identifier is missing', () => {
      const body = {
        type: 'Issue',
        action: 'create',
        data: { id: 'lin-uuid', labels: [{ name: 'ai-sdlc' }] },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.taskId).toBe('lin-uuid');
    });

    it('should handle labelIds fallback', () => {
      const body = {
        type: 'Issue',
        action: 'create',
        data: { id: 'lin-4', labelIds: [{ name: 'ai-sdlc' }] },
      };
      const result = handler.parse({}, body, 'tenant-1');
      expect(result._unsafeUnwrap()!.labels).toContain('ai-sdlc');
    });
  });
});
