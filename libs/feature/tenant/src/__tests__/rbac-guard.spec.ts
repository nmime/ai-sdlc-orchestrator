import { RbacGuard } from '../guards/rbac.guard';
import { ForbiddenException } from '@nestjs/common';

const _ROLES_KEY = 'roles';

function createGuard(requiredRoles: string[] | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
  };
  return new RbacGuard(reflector as any);
}

function mockContext(user: { role?: string; tenantId?: string } | undefined, params: Record<string, string> = {}): any {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  };
}

describe('RbacGuard', () => {
  it('allows when no roles required', () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(mockContext({ role: 'viewer' }))).toBe(true);
  });

  it('allows when empty roles array', () => {
    const guard = createGuard([]);
    expect(guard.canActivate(mockContext({ role: 'viewer' }))).toBe(true);
  });

  it('allows matching role', () => {
    const guard = createGuard(['admin', 'operator']);
    expect(guard.canActivate(mockContext({ role: 'admin' }))).toBe(true);
  });

  it('denies non-matching role', () => {
    const guard = createGuard(['admin']);
    expect(() => guard.canActivate(mockContext({ role: 'viewer' }))).toThrow(ForbiddenException);
  });

  it('denies when no role assigned', () => {
    const guard = createGuard(['admin']);
    expect(() => guard.canActivate(mockContext({}))).toThrow('No role assigned');
  });

  it('denies cross-tenant access', () => {
    const guard = createGuard(['admin']);
    expect(() => guard.canActivate(
      mockContext({ role: 'admin', tenantId: 'tenant-a' }, { tenantId: 'tenant-b' }),
    )).toThrow('Access denied for this tenant');
  });

  it('allows dev-tenant to access any tenant', () => {
    const guard = createGuard(['admin']);
    expect(guard.canActivate(
      mockContext({ role: 'admin', tenantId: 'dev-tenant' }, { tenantId: 'tenant-b' }),
    )).toBe(true);
  });

  it('allows when request has no tenantId param', () => {
    const guard = createGuard(['admin']);
    expect(guard.canActivate(mockContext({ role: 'admin', tenantId: 'tenant-a' }))).toBe(true);
  });
});
