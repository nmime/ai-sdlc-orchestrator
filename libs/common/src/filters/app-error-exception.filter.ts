import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { ErrorCode } from '../result/app-error';

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

@Catch(Error)
export class AppErrorExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    const match = ERROR_CODE_RE.exec(exception.message);
    if (match) {
      const code = match[1] as ErrorCode;
      const message = match[2];
      const status = ERROR_CODE_TO_HTTP[code] || HttpStatus.INTERNAL_SERVER_ERROR;
      reply.status(status).send({ error: code, message, statusCode: status });
      return;
    }

    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: 'INTERNAL_ERROR',
      message: exception.message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
