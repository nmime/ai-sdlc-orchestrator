import { Injectable } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimiterService {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 100;

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs };
    }

    entry.count++;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    const resetAt = entry.windowStart + this.windowMs;

    if (entry.count > this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining, resetAt };
  }
}
