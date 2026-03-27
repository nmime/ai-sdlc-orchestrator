import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, TenantUser, TenantWebhookConfig, WebhookDelivery,
  WorkflowMirror, WorkflowEvent, WorkflowDsl, WorkflowArtifact,
  AgentSession, AgentToolCall, CostAlert, PollingSchedule, McpServerRegistry,
} from '@ai-sdlc/db';
import { AllExceptionsFilter, PinoLoggerService, LoggerModule, TemporalClientService } from '@ai-sdlc/common';
import { TenantModule } from '@ai-sdlc/feature-tenant';
import { WebhookModule } from '@ai-sdlc/feature-webhook';
import { GateModule } from '@ai-sdlc/feature-gate';
import { HealthController } from '../../apps/orchestrator-api/src/health.controller';
import { WorkflowsController } from '../../apps/orchestrator-api/src/workflows.controller';
import { CostController } from '../../apps/orchestrator-api/src/cost.controller';
import { MetricsController } from '../../apps/orchestrator-api/src/metrics.controller';

const ALL_ENTITIES = [
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, TenantUser, TenantWebhookConfig, WebhookDelivery,
  WorkflowMirror, WorkflowEvent, WorkflowDsl, WorkflowArtifact,
  AgentSession, AgentToolCall, CostAlert, PollingSchedule, McpServerRegistry,
];

async function main() {
  const port = Number(process.env.DATABASE_PORT || 5432);
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            DATABASE_HOST: process.env.DATABASE_HOST || '127.0.0.1',
            DATABASE_PORT: port,
            DATABASE_NAME: process.env.DATABASE_NAME || 'test_e2e',
            DATABASE_USER: process.env.DATABASE_USER || 'test',
            DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'test',
            NODE_ENV: 'development',
            MINIO_ACCESS_KEY: 'minioadmin',
            MINIO_SECRET_KEY: 'minioadmin',
            CREDENTIAL_PROXY_INTERNAL_TOKEN: 'test-token-minimum-16-chars',
            TEMPORAL_ADDRESS: 'localhost:7233',
            TEMPORAL_NAMESPACE: 'default',
            CORS_ORIGINS: 'http://localhost:5174',
          }),
        ],
      }),
      MikroOrmModule.forRoot({
        driver: PostgreSqlDriver,
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port,
        dbName: process.env.DATABASE_NAME || 'test_e2e',
        user: process.env.DATABASE_USER || 'test',
        password: process.env.DATABASE_PASSWORD || 'test',
        entities: ALL_ENTITIES,
        allowGlobalContext: true,
        debug: false,
      }),
      LoggerModule,
      TerminusModule,
      TenantModule,
      WebhookModule,
      GateModule,
    ],
    controllers: [HealthController, WorkflowsController, CostController, MetricsController],
  })
    .overrideProvider(TemporalClientService)
    .useValue({
      getClient: () => { throw new Error('Temporal not available'); },
      onModuleDestroy: () => {},
    })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const logger = await app.resolve(PinoLoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.enableCors({ origin: 'http://localhost:5174', credentials: true });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  await app.listen(3333, '0.0.0.0');
  console.log('[e2e-server] NestJS listening on port 3333');
}

main().catch((err) => {
  console.error('[e2e-server] Error:', err);
  process.exit(1);
});
