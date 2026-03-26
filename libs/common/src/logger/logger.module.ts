import { Module, Global, LoggerService, Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

let loggerInstance: pino.Logger | undefined;

function getLogger(): pino.Logger {
  if (!loggerInstance) {
    const config = new ConfigService(process.env);
    loggerInstance = pino({
      level: config.get<string>('WORKER_LOG_LEVEL') || 'info',
      transport:
        config.get<string>('NODE_ENV') !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    });
  }
  return loggerInstance;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLoggerService implements LoggerService {
  private context = 'App';

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    getLogger().info({ context: this.context, ...this.extractMeta(optionalParams) }, message);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    getLogger().error({ context: this.context, ...this.extractMeta(optionalParams) }, message);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    getLogger().warn({ context: this.context, ...this.extractMeta(optionalParams) }, message);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    getLogger().debug({ context: this.context, ...this.extractMeta(optionalParams) }, message);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    getLogger().trace({ context: this.context, ...this.extractMeta(optionalParams) }, message);
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
