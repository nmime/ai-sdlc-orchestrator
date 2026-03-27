import { FastifyRequest } from 'fastify';

export const VALID_ROLES = ['admin', 'operator', 'viewer'] as const;
export type UserRole = typeof VALID_ROLES[number];

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: UserRole;
  tenantId: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}
