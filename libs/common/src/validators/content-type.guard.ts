import { CanActivate, ExecutionContext, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

const ALLOWED_CONTENT_TYPES = ['application/json'];

@Injectable()
export class ContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return true;
    }

    const contentType = request.headers['content-type'];
    if (!contentType) {
      throw new UnsupportedMediaTypeException('Content-Type header is required');
    }

    const mediaType = contentType.split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(mediaType)) {
      throw new UnsupportedMediaTypeException(`Unsupported Content-Type: ${mediaType}`);
    }

    return true;
  }
}
