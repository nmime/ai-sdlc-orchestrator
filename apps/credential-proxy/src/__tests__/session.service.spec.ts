import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    const configService = { get: vi.fn().mockImplementation((key: string) => {
      if (key === 'SESSION_SIGNING_KEY') return 'a'.repeat(64);
      return undefined;
    }) } as unknown as ConfigService;
    service = new SessionService(configService);
    service.onModuleInit();
  });

  describe('create', () => {
    it('creates a session with token and expiry', () => {
      const result = service.create('tenant-1', 'wf-1', 'sess-1');
      expect(result.token).toBeDefined();
      expect(result.token.split('.')).toHaveLength(2);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('creates sessions with unique tokens', () => {
      const r1 = service.create('t1', 'wf1', 's1');
      const r2 = service.create('t1', 'wf1', 's2');
      expect(r1.token).not.toBe(r2.token);
    });

    it('respects custom TTL', () => {
      const result = service.create('t1', 'wf1', 's1', 10);
      const expiresAt = new Date(result.expiresAt).getTime();
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 11_000);
    });

    it('accepts custom scopes', () => {
      const result = service.create('t1', 'wf1', 's1', 3600, ['git']);
      expect(service.hasScope(result.token, 'git')).toBe(true);
      expect(service.hasScope(result.token, 'mcp')).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns session data for valid token', () => {
      const { token } = service.create('tenant-1', 'wf-1', 'sess-1');
      const session = service.validate(token);
      expect(session).not.toBeNull();
      expect(session!.tenantId).toBe('tenant-1');
      expect(session!.workflowId).toBe('wf-1');
      expect(session!.sessionId).toBe('sess-1');
    });

    it('returns null for unknown token', () => {
      expect(service.validate('fake.token')).toBeNull();
    });

    it('returns null for expired token', () => {
      const { token } = service.create('t1', 'wf1', 's1', -1);
      expect(service.validate(token)).toBeNull();
    });

    it('increments request count on each validation', () => {
      const { token } = service.create('t1', 'wf1', 's1');
      service.validate(token);
      service.validate(token);
      const session = service.validate(token);
      expect(session!.requestCount).toBe(3);
    });
  });

  describe('hasScope', () => {
    it('returns true for valid scope', () => {
      const { token } = service.create('t1', 'wf1', 's1', 3600, ['git', 'mcp']);
      expect(service.hasScope(token, 'git')).toBe(true);
      expect(service.hasScope(token, 'mcp')).toBe(true);
    });

    it('returns false for missing scope', () => {
      const { token } = service.create('t1', 'wf1', 's1', 3600, ['git']);
      expect(service.hasScope(token, 'ai-api')).toBe(false);
    });

    it('returns false for unknown token', () => {
      expect(service.hasScope('unknown', 'git')).toBe(false);
    });
  });

  describe('revoke', () => {
    it('removes session by sessionId', () => {
      const { token } = service.create('t1', 'wf1', 'sess-to-revoke');
      expect(service.validate(token)).not.toBeNull();
      service.revoke('sess-to-revoke');
      expect(service.validate(token)).toBeNull();
    });

    it('does not affect other sessions', () => {
      service.create('t1', 'wf1', 'sess-1');
      const { token: t2 } = service.create('t1', 'wf1', 'sess-2');
      service.revoke('sess-1');
      expect(service.validate(t2)).not.toBeNull();
    });
  });

  describe('getActiveCount', () => {
    it('returns count of active sessions', () => {
      expect(service.getActiveCount()).toBe(0);
      service.create('t1', 'wf1', 's1');
      service.create('t1', 'wf1', 's2');
      expect(service.getActiveCount()).toBe(2);
    });
  });
});
