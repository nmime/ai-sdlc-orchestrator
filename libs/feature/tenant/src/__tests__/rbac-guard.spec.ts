import { RbacGuard } from '../guards/rbac.guard';
import { Reflector } from '@nestjs/core';

function mockContext(user?: { role: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RbacGuard', () => {
  it('should allow when no roles required', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext({ role: 'viewer' }))).toBe(true);
  });

  it('should allow when roles array is empty', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([]) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext({ role: 'viewer' }))).toBe(true);
  });

  it('should allow when user role matches required role', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['admin', 'operator']) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext({ role: 'admin' }))).toBe(true);
  });

  it('should deny when user role does not match', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['admin']) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext({ role: 'viewer' }))).toBe(false);
  });

  it('should deny when no user on request', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['admin']) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext())).toBe(false);
  });

  it('should deny when user has no role', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['admin']) } as any;
    const guard = new RbacGuard(reflector);
    expect(guard.canActivate(mockContext({ role: '' } as any))).toBe(false);
  });

  it('should use reflector with handler and class', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(null) } as any;
    const guard = new RbacGuard(reflector);
    const ctx = mockContext({ role: 'admin' });
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [ctx.getHandler(), ctx.getClass()]);
  });
});
