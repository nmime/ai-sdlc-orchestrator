import { RateLimiterService } from '../rate-limiter.service';

describe('RateLimiterService', () => {
  let limiter: RateLimiterService;

  beforeEach(() => {
    limiter = new RateLimiterService();
  });

  it('allows requests within limit', () => {
    const result = limiter.check('session-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('tracks remaining requests', () => {
    limiter.check('session-1');
    limiter.check('session-1');
    const result = limiter.check('session-1');
    expect(result.remaining).toBe(97);
  });

  it('blocks requests exceeding limit', () => {
    for (let i = 0; i <= 100; i++) {
      limiter.check('session-1');
    }
    const result = limiter.check('session-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks separate keys independently', () => {
    for (let i = 0; i <= 100; i++) {
      limiter.check('session-1');
    }
    const result = limiter.check('session-2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('provides resetAt timestamp', () => {
    const result = limiter.check('session-1');
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});
