import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';

function mockConfig(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

describe('SessionService', () => {
  let svc: SessionService;

  beforeEach(() => {
    svc = new SessionService(mockConfig({ SESSION_SIGNING_KEY: 'test-key-hex' }));
  });

  it('creates a session and returns a token', () => {
    const result = svc.create('tenant-1', 'wf-1', 'sess-1');
    expect(result.token).toBeTruthy();
    expect(result.token).toContain('.');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('validates a created session', () => {
    const { token } = svc.create('tenant-1', 'wf-1', 'sess-1');
    const session = svc.validate(token);
    expect(session).not.toBeNull();
    expect(session!.tenantId).toBe('tenant-1');
    expect(session!.sessionId).toBe('sess-1');
  });

  it('returns null for unknown token', () => {
    expect(svc.validate('bad.token')).toBeNull();
  });

  it('revokes sessions by sessionId', () => {
    const { token } = svc.create('tenant-1', 'wf-1', 'sess-1');
    svc.revoke('sess-1');
    expect(svc.validate(token)).toBeNull();
  });

  it('uses random signing key when none configured', () => {
    const svc2 = new SessionService(mockConfig());
    const { token } = svc2.create('t', 'w', 's');
    expect(svc2.validate(token)).not.toBeNull();
  });
});
