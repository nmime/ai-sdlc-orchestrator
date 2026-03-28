import { describe, it, expect } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

const WorkflowStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

function getTenantId(req: { user?: { tenantId?: string } }): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new ForbiddenException('Tenant context required');
  return tenantId;
}

function validateStatus(status: string | undefined): void {
  if (status && !Object.values(WorkflowStatus).includes(status as any)) {
    throw new BadRequestException('Invalid status');
  }
}

function clampPagination(limit?: string, offset?: string): { limit: number; offset: number } {
  return {
    limit: Math.min(parseInt(limit || '50', 10) || 50, 200),
    offset: Math.max(parseInt(offset || '0', 10) || 0, 0),
  };
}

function calculateDuration(startedAt: Date | null, completedAt: Date | null): number | null {
  if (completedAt && startedAt) {
    return (completedAt.getTime() - startedAt.getTime()) / 1000;
  }
  return null;
}

describe('WorkflowsController business logic', () => {
  describe('getTenantId', () => {
    it('extracts tenantId from authenticated user', () => {
      expect(getTenantId({ user: { tenantId: 'abc' } })).toBe('abc');
    });

    it('throws ForbiddenException when no user', () => {
      expect(() => getTenantId({})).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when no tenantId', () => {
      expect(() => getTenantId({ user: {} })).toThrow('Tenant context required');
    });
  });

  describe('validateStatus', () => {
    it('accepts valid workflow statuses', () => {
      expect(() => validateStatus('PENDING')).not.toThrow();
      expect(() => validateStatus('RUNNING')).not.toThrow();
      expect(() => validateStatus('COMPLETED')).not.toThrow();
      expect(() => validateStatus('FAILED')).not.toThrow();
      expect(() => validateStatus('CANCELLED')).not.toThrow();
    });

    it('accepts undefined status (no filter)', () => {
      expect(() => validateStatus(undefined)).not.toThrow();
    });

    it('rejects invalid status', () => {
      expect(() => validateStatus('INVALID')).toThrow(BadRequestException);
      expect(() => validateStatus('running')).toThrow(BadRequestException);
    });

    it('allows empty string (falsy, skips check)', () => {
      expect(() => validateStatus('')).not.toThrow();
    });
  });

  describe('clampPagination', () => {
    it('uses defaults when no params', () => {
      expect(clampPagination()).toEqual({ limit: 50, offset: 0 });
    });

    it('clamps limit at 200', () => {
      expect(clampPagination('500')).toEqual({ limit: 200, offset: 0 });
    });

    it('clamps negative offset to 0', () => {
      expect(clampPagination('50', '-10')).toEqual({ limit: 50, offset: 0 });
    });

    it('handles NaN gracefully (falls back to defaults)', () => {
      const result = clampPagination('abc', 'xyz');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('parses valid numbers', () => {
      expect(clampPagination('25', '100')).toEqual({ limit: 25, offset: 100 });
    });

    it('limit of 0 falls back to 50', () => {
      const result = clampPagination('0');
      expect(result.limit).toBe(50);
    });
  });
});

describe('CostController business logic', () => {
  describe('calculateDuration', () => {
    it('calculates duration in seconds', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T00:05:00Z');
      expect(calculateDuration(start, end)).toBe(300);
    });

    it('returns null when completedAt is null', () => {
      expect(calculateDuration(new Date(), null)).toBeNull();
    });

    it('returns null when startedAt is null', () => {
      expect(calculateDuration(null, new Date())).toBeNull();
    });

    it('returns null when both are null', () => {
      expect(calculateDuration(null, null)).toBeNull();
    });

    it('handles sub-second durations', () => {
      const start = new Date('2024-01-01T00:00:00.000Z');
      const end = new Date('2024-01-01T00:00:00.500Z');
      expect(calculateDuration(start, end)).toBe(0.5);
    });

    it('handles long-running sessions', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T02:00:00Z');
      expect(calculateDuration(start, end)).toBe(7200);
    });
  });
});
