import { createParamDecorator, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../guards/auth.guard';

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const tenantId = request.user?.tenantId;
  if (!tenantId) throw new ForbiddenException('Missing tenantId');
  return tenantId;
});

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
