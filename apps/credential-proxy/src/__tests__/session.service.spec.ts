import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';

const store = new Map<string, { value: string; ttl?: number }>();
const sets = new Map<string, Set<string>>();

function makeRedisMock() {
  return {
    connect: () => Promise.resolve(),
    quit: () => Promise.resolve(),
    get: (key: string) => Promise.resolve(store.get(key)?.value ?? null),
    set: (key: string, value: string, _ex?: string, _ttl?: number) => {
      store.set(key, { value, ttl: _ttl });
      return Promise.resolve('OK');
    },
    del: (key: string) => { store.delete(key); sets.delete(key); return Promise.resolve(1); },
    sadd: (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return Promise.resolve(1);
    },
    smembers: (key: string) => Promise.resolve([...(sets.get(key) ?? [])]),
    expire: () => Promise.resolve(1),
    pipeline: function() {
      const self = this;
      const cmds: Array<() => Promise<unknown>> = [];
      const pipe: Record<string, unknown> = {
        set: (k: string, v: string, ex?: string, ttl?: number) => { cmds.push(() => self.set(k, v, ex, ttl)); return pipe; },
        sadd: (k: string, m: string) => { cmds.push(() => self.sadd(k, m)); return pipe; },
        expire: () => pipe,
        del: (k: string) => { cmds.push(() => self.del(k)); return pipe; },
        exec: async () => { for (const fn of cmds) await fn(); return []; },
      };
      return pipe;
    },
  };
}

vi.mock('ioredis', () => {
  return {
    default: function Redis() {
      return makeRedisMock();
    },
  };
});

function mockConfig(overrides: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => overrides[key] } as unknown as ConfigService;
}

describe('SessionService', () => {
  let svc: SessionService;

  beforeEach(() => {
    store.clear();
    sets.clear();
    svc = new SessionService(mockConfig({ SESSION_SIGNING_KEY: 'a'.repeat(32) }));
  });

  afterEach(async () => {
    await svc.onModuleDestroy();
  });

  it('creates a session and returns a token', async () => {
    const result = await svc.create('tenant-1', 'wf-1', 'sess-1');
    expect(result.token).toBeTruthy();
    expect(result.token).toContain('.');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('validates a created session', async () => {
    const { token } = await svc.create('tenant-1', 'wf-1', 'sess-1');
    const session = await svc.validate(token);
    expect(session).not.toBeNull();
    expect(session!.tenantId).toBe('tenant-1');
    expect(session!.sessionId).toBe('sess-1');
  });

  it('returns null for unknown token', async () => {
    expect(await svc.validate('bad.token')).toBeNull();
  });

  it('revokes sessions by sessionId', async () => {
    const { token } = await svc.create('tenant-1', 'wf-1', 'sess-1');
    await svc.revoke('sess-1');
    expect(await svc.validate(token)).toBeNull();
  });

  it('uses random signing key when none configured', async () => {
    const svc2 = new SessionService(mockConfig());
    const { token } = await svc2.create('t', 'w', 's');
    expect(await svc2.validate(token)).not.toBeNull();
    await svc2.onModuleDestroy();
  });
});
