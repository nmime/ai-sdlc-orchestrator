import { AuditService, type AuditEntry } from '../audit.service';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService();
  });

  const makeEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
    timestamp: new Date().toISOString(),
    sessionId: 'sess-1',
    tenantId: 'tenant-1',
    action: 'git-credential',
    resource: 'github.com',
    status: 'success',
    ...overrides,
  });

  it('logs and retrieves entries', () => {
    service.log(makeEntry());
    service.log(makeEntry({ action: 'mcp-token' }));
    expect(service.getRecent()).toHaveLength(2);
  });

  it('respects limit on getRecent', () => {
    for (let i = 0; i < 10; i++) service.log(makeEntry());
    expect(service.getRecent(5)).toHaveLength(5);
  });

  it('returns recent entries last', () => {
    service.log(makeEntry({ action: 'first' }));
    service.log(makeEntry({ action: 'second' }));
    const entries = service.getRecent();
    expect(entries[entries.length - 1].action).toBe('second');
  });

  it('filters by session', () => {
    service.log(makeEntry({ sessionId: 'a' }));
    service.log(makeEntry({ sessionId: 'b' }));
    service.log(makeEntry({ sessionId: 'a' }));
    expect(service.getBySession('a')).toHaveLength(2);
    expect(service.getBySession('b')).toHaveLength(1);
  });

  it('trims old entries when exceeding max', () => {
    for (let i = 0; i < 10_001; i++) {
      service.log(makeEntry({ action: `action-${i}` }));
    }
    expect(service.getRecent(20_000).length).toBeLessThanOrEqual(10_000);
  });
});
