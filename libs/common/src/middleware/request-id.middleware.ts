import { Module, Global, Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

@Global()
@Module({})
export class RequestIdModule {}
