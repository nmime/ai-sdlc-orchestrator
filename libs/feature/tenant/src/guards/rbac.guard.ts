import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.role) throw new ForbiddenException('No role assigned');

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Role '${user.role}' not authorized. Required: ${requiredRoles.join(', ')}`);
    }

    const tenantId = request.params?.tenantId;
    if (tenantId && user.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied for this tenant');
    }

    return true;
  }
}
