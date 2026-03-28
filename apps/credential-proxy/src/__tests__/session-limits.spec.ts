import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';

function makeService(secret = '0123456789abcdef0123456789abcdef') {
  const config = {
    get: (key: string) => {
      if (key === 'SESSION_SIGNING_KEY') return secret;
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as any as ConfigService;
  const svc = new SessionService(config);
  svc.onModuleInit();
  return svc;
}

describe('SessionService real behavior', () => {
  let svc: SessionService;

  beforeEach(() => {
    svc = makeService();
  });

  describe('token integrity', () => {
    it('creates token in nonce.hmac format', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      expect(session.token).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);
    });

    it('validates its own tokens', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      const validated = svc.validate(session.token);
      expect(validated).toBeTruthy();
      expect(validated!.tenantId).toBe('t1');
      expect(validated!.scopes).toContain('git');
    });

    it('rejects tampered HMAC', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      const [nonce] = session.token.split('.');
      const tamperedToken = `${nonce}.deadbeef`;
      expect(svc.validate(tamperedToken)).toBeNull();
    });

    it('rejects tampered nonce', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      const [, hmac] = session.token.split('.');
      const tamperedToken = `aaaa.${hmac}`;
      expect(svc.validate(tamperedToken)).toBeNull();
    });

    it('rejects tokens from different signing key', () => {
      const svc2 = makeService('fedcba9876543210fedcba9876543210');
      const session = svc2.create('t1', 'wf1', 'sess1', 3600);
      expect(svc.validate(session.token)).toBeNull();
    });
  });

  describe('expiration', () => {
    it('rejects expired session', async () => {
      const session = svc.create("t1", "wf1", "sess1", 1);
      await new Promise(r => setTimeout(r, 1100));
      expect(svc.validate(session.token)).toBeNull();
    });
  });

  describe('scope enforcement', () => {
    it('stores and returns scopes', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600, ['ai:read', 'git:write']);
      const validated = svc.validate(session.token);
      expect(validated!.scopes).toEqual(['ai:read', 'git:write']);
    });

    it('uses default scopes when not specified', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      const validated = svc.validate(session.token);
      expect(validated!.scopes).toEqual(['git', 'mcp', 'ai-api']);
    });

    it('hasScope checks correctly', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600, ['ai:read']);
      expect(svc.hasScope(session.token, 'ai:read')).toBe(true);
      expect(svc.hasScope(session.token, 'git:write')).toBe(false);
    });
  });

  describe('revocation', () => {
    it('revoked session becomes invalid', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      expect(svc.validate(session.token)).toBeTruthy();
      svc.revoke('sess1');
      expect(svc.validate(session.token)).toBeNull();
    });
  });

  describe('per-tenant limits', () => {
    it('enforces per-tenant session limit of 100', () => {
      for (let i = 0; i < 100; i++) {
        svc.create('limit-tenant', `wf${i}`, `sess-${i}`, 3600);
      }
      expect(() => svc.create('limit-tenant', 'wf-x', 'sess-overflow', 3600)).toThrow(/session limit/i);
    });

    it('different tenants have independent limits', () => {
      for (let i = 0; i < 100; i++) {
        svc.create('tenant-a', `wf${i}`, `sess-a-${i}`, 3600);
      }
      expect(() => svc.create('tenant-b', 'wf1', 'sess-b-1', 3600)).not.toThrow();
    });
  });

  describe('uniqueness', () => {
    it('every token is unique', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const s = svc.create('t1', `wf${i}`, `sess-${i}`, 3600);
        tokens.add(s.token);
      }
      expect(tokens.size).toBe(50);
    });
  });

  describe('request counting', () => {
    it('increments request count on each validate', () => {
      const session = svc.create('t1', 'wf1', 'sess1', 3600);
      svc.validate(session.token);
      svc.validate(session.token);
      const result = svc.validate(session.token);
      expect(result!.requestCount).toBe(3);
    });
  });

  describe('active sessions count', () => {
    it('tracks active count', () => {
      svc.create('t1', 'wf1', 'sess1', 3600);
      svc.create('t1', 'wf2', 'sess2', 3600);
      expect(svc.getActiveCount()).toBe(2);
      svc.revoke('sess1');
      expect(svc.getActiveCount()).toBe(1);
    });
  });

  describe('missing signing key', () => {
    it('throws on init without key in production', () => {
      const config = {
        get: (key: string) => {
          if (key === 'SESSION_SIGNING_KEY') return '';
          if (key === 'NODE_ENV') return 'production';
          return undefined;
        },
      } as any;
      const s = new SessionService(config);
      expect(() => s.onModuleInit()).toThrow(/SESSION_SIGNING_KEY/i);
    });
  });
});
