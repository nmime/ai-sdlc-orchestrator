import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';

export const appConfigSchema = z.object({
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(6432),
  DATABASE_NAME: z.string().default('orchestrator'),
  DATABASE_USER: z.string().default('orchestrator'),
  DATABASE_PASSWORD: z.string(),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('artifacts'),
  E2B_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  API_PORT: z.coerce.number().default(3000),
  WORKER_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  CREDENTIAL_PROXY_BIND: z.string().default('127.0.0.1'),
  CREDENTIAL_PROXY_INTERNAL_TOKEN: z.string().min(16),
  CREDENTIAL_PROXY_PORT: z.coerce.number().default(3002),
  CREDENTIAL_PROXY_URL: z.string().default('http://localhost:3002'),
  DEFAULT_VCS_TOKEN: z.string().optional(),
  SESSION_SIGNING_KEY: z.string().min(32).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  APP_VERSION: z.string().default('0.0.1'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: (config: Record<string, unknown>) => appConfigSchema.parse(config),
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
