import { Module, Global, type LoggerService, Injectable, Scope } from '@nestjs/common';
import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';

const logger = pino({
  level: process.env['LOG_LEVEL'] || process.env['WORKER_LOG_LEVEL'] || 'info',
  transport: !isProduction
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env['SERVICE_NAME'] || 'orchestrator-api',
    ...(isProduction ? { pid: process.pid } : {}),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.secret', '*.token', '*.apiKey'],
    censor: '[REDACTED]',
  },
});

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLoggerService implements LoggerService {
  private context = 'App';
  private bindings: Record<string, unknown> = {};

  setContext(context: string): void {
    this.context = context;
  }

  withBindings(bindings: Record<string, unknown>): PinoLoggerService {
    this.bindings = { ...this.bindings, ...bindings };
    return this;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    logger.info({ context: this.context, ...this.bindings, ...this.extractMeta(optionalParams) }, message);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    logger.error({ context: this.context, ...this.bindings, ...this.extractMeta(optionalParams) }, message);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    logger.warn({ context: this.context, ...this.bindings, ...this.extractMeta(optionalParams) }, message);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    logger.debug({ context: this.context, ...this.bindings, ...this.extractMeta(optionalParams) }, message);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    logger.trace({ context: this.context, ...this.bindings, ...this.extractMeta(optionalParams) }, message);
  }

  private extractMeta(params: unknown[]): Record<string, unknown> {
    if (params.length === 0) return {};
    const last = params[params.length - 1];
    if (typeof last === 'string') return { context: last };
    if (typeof last === 'object' && last !== null) return last as Record<string, unknown>;
    return {};
  }
}

@Global()
@Module({
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggerModule {}
