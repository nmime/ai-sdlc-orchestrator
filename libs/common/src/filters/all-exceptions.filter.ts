import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply, FastifyRequest } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'AllExceptionsFilter' });

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (status >= 500) {
      logger.error(
        { method: request.method, url: request.url, statusCode: status, err: exception instanceof Error ? exception.stack : String(exception) },
        `${request.method} ${request.url} ${status}`,
      );
    } else if (status >= 400) {
      logger.warn(
        { method: request.method, url: request.url, statusCode: status },
        `${request.method} ${request.url} ${status}: ${message}`,
      );
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    reply.status(status).send(body);
  }
}
