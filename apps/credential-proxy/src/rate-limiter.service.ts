import { Injectable } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimiterService {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60_000;
  private readonly defaultMax = parseInt(process.env['RATE_LIMIT_MAX'] || '100', 10);
  private tenantLimits = new Map<string, number>();

  setTenantLimit(tenantId: string, maxRequests: number): void {
    this.tenantLimits.set(tenantId, maxRequests);
  }

  check(key: string, tenantId?: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const maxRequests = (tenantId && this.tenantLimits.get(tenantId)) || this.defaultMax;
    const limitKey = tenantId ? `tenant:${tenantId}:${key}` : key;
    const entry = this.limits.get(limitKey);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.limits.set(limitKey, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + this.windowMs };
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetAt = entry.windowStart + this.windowMs;

    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining, resetAt };
  }
}
