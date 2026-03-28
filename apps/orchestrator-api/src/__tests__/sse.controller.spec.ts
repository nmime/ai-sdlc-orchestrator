import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SseController } from '../sse.controller';

function createMockEm() {
  const em = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    fork: vi.fn(),
    clear: vi.fn(),
  } as any;
  em.fork.mockReturnValue(em);
  return em;
}

describe('SseController', () => {
  let controller: SseController;
  const mockConfig = { get: () => '100' };
  const mockReq = { user: { tenantId: 't-1' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SseController(createMockEm(), mockConfig as any);
  });

  it('throws if no tenant context', () => {
    expect(() => controller.events({ user: {} } as any)).toThrow('Tenant context required');
  });

  it('returns an Observable', () => {
    const obs = controller.events(mockReq);
    expect(obs).toBeDefined();
    expect(typeof obs.subscribe).toBe('function');
  });
});
