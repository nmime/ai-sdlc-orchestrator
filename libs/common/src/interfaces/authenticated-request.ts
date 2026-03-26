import { FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  user: { sub: string; email: string; role: string; tenantId: string };
}
