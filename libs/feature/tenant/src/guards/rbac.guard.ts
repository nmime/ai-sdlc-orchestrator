import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AppConfig } from '@app/common';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService<AppConfig, true>,
  ) {}

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
      throw new ForbiddenException('Insufficient permissions');
    }

    const tenantId = request.params?.tenantId;
    if (tenantId) {
      if (!user.tenantId) throw new ForbiddenException('Tenant context required');
      const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
      const isDevTenantAllowed = user.tenantId === 'dev-tenant' && (nodeEnv === 'development' || nodeEnv === 'test');
      if (user.tenantId !== tenantId && !isDevTenantAllowed) {
        throw new ForbiddenException('Access denied for this tenant');
      }
    }

    return true;
  }
}
