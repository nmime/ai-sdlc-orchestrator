import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, HttpException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { ErrorCode } from '../result/app-error';
import { NotFoundError } from '@mikro-orm/core';

const ERROR_CODE_TO_HTTP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  BUDGET_EXCEEDED: HttpStatus.PAYMENT_REQUIRED,
  AGENT_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  SANDBOX_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  TEMPORAL_ERROR: HttpStatus.BAD_GATEWAY,
  VCS_ERROR: HttpStatus.BAD_GATEWAY,
  WEBHOOK_ERROR: HttpStatus.BAD_REQUEST,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

const ERROR_CODE_RE = /^\[([A-Z_]+)] (.+)$/;
const UNIQUE_VIOLATION_CODE = '23505';

@Catch(Error)
export class AppErrorExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      reply.status(status).send(
        typeof response === 'string'
          ? { error: 'ERROR', message: response, statusCode: status }
          : response,
      );
      return;
    }

    if (exception instanceof NotFoundError) {
      reply.status(HttpStatus.NOT_FOUND).send({
        error: 'NOT_FOUND',
        message: 'Resource not found',
        statusCode: HttpStatus.NOT_FOUND,
      });
      return;
    }

    if ((exception as any).code === UNIQUE_VIOLATION_CODE) {
      reply.status(HttpStatus.CONFLICT).send({
        error: 'CONFLICT',
        message: 'Resource already exists',
        statusCode: HttpStatus.CONFLICT,
      });
      return;
    }

    const match = ERROR_CODE_RE.exec(exception.message);
    if (match) {
      const code = match[1] as ErrorCode;
      const status = ERROR_CODE_TO_HTTP[code] || HttpStatus.INTERNAL_SERVER_ERROR;
      reply.status(status).send({ error: code, message: 'Request failed', statusCode: status });
      return;
    }

    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
