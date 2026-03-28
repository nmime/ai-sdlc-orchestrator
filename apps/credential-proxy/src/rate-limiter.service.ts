import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const MAX_LIMIT_ENTRIES = 50_000;
const MAX_TENANT_ENTRIES = 50_000;

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly defaultMax: number;
  private tenantLimits = new Map<string, number>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly configService: ConfigService) {
    this.windowMs = parseInt(this.configService.get<string>('RATE_LIMIT_WINDOW_MS') || '60000', 10);
    this.defaultMax = parseInt(this.configService.get<string>('RATE_LIMIT_MAX') || '100', 10);
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), this.windowMs * 2);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now - entry.windowStart > this.windowMs) {
        this.limits.delete(key);
      }
    }
  }

  setTenantLimit(tenantId: string, maxRequests: number): void {
    if (this.tenantLimits.size >= MAX_TENANT_ENTRIES) return;
    this.tenantLimits.set(tenantId, maxRequests);
  }

  check(key: string, tenantId?: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const maxRequests = (tenantId && this.tenantLimits.get(tenantId)) || this.defaultMax;
    const limitKey = tenantId ? `tenant:${tenantId}:${key}` : key;
    const entry = this.limits.get(limitKey);

    if (!entry || now - entry.windowStart > this.windowMs) {
      if (this.limits.size >= MAX_LIMIT_ENTRIES && !this.limits.has(limitKey)) {
        return { allowed: false, remaining: 0, resetAt: now + this.windowMs };
      }
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
