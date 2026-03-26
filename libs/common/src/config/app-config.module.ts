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
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('artifacts'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_PRESIGNED_TTL_SECONDS: z.coerce.number().default(3600),
  E2B_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  API_PORT: z.coerce.number().default(3000),
  WORKER_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  CREDENTIAL_PROXY_URL: z.string().default('http://localhost:4000'),
  CREDENTIAL_PROXY_INTERNAL_TOKEN: z.string().min(1, 'CREDENTIAL_PROXY_INTERNAL_TOKEN is required'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  SANDBOX_TIMEOUT_MS: z.coerce.number().default(600_000),
  SANDBOX_COST_PER_HOUR_USD: z.coerce.number().default(0.05),
  AGENT_MAX_DURATION_MS: z.coerce.number().default(3_600_000),
  AGENT_MAX_TURNS: z.coerce.number().default(25),
  BUDGET_RESERVATION_USD: z.coerce.number().default(50),
  DEFAULT_AGENT_PROVIDER: z.string().default('claude_code'),
  DEFAULT_AGENT_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ENCRYPTION_KEY: z.string().optional(),
  ENCRYPTION_SALT: z.string().min(16, 'ENCRYPTION_SALT must be at least 16 characters'),
  SSE_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  AI_INPUT_COST_PER_1M: z.coerce.number().default(3.0),
  AI_OUTPUT_COST_PER_1M: z.coerce.number().default(15.0),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(5),
  WEBHOOK_RETRY_INTERVAL_MS: z.coerce.number().default(60000),
  WEBHOOK_RETRY_BATCH_SIZE: z.coerce.number().default(10),
  POLLING_INTERVAL_MS: z.coerce.number().default(60000),
  SANITIZER_MODE: z.enum(['block', 'warn', 'off']).default('block'),
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
