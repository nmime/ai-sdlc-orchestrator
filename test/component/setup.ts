import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ValidationPipe } from '@nestjs/common';
import {
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, ApiKeyRole, TenantUser, TenantWebhookConfig, WebhookDelivery,
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
import { createHash, randomBytes } from 'crypto';

const ALL_ENTITIES = [
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, TenantUser, TenantWebhookConfig, WebhookDelivery,
  WorkflowMirror, WorkflowEvent, WorkflowDsl, WorkflowArtifact,
  AgentSession, AgentToolCall, CostAlert, PollingSchedule, McpServerRegistry,
];

let pgContainer: StartedPostgreSqlContainer;
let app: NestFastifyApplication;
let orm: MikroORM;
let tenant: Tenant;
let apiKeyRaw: string;

const mockTemporalClient = {
  getClient: vi.fn().mockRejectedValue(new Error('Temporal not available')),
  onModuleDestroy: vi.fn(),
};

export async function setupTestApp() {
  pgContainer = await new PostgreSqlContainer('postgres:17')
    .withDatabase('test_orchestrator')
    .withUsername('test')
    .withPassword('test')
    .start();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            DATABASE_HOST: pgContainer.getHost(),
            DATABASE_PORT: pgContainer.getPort(),
            DATABASE_NAME: 'test_orchestrator',
            DATABASE_USER: 'test',
            DATABASE_PASSWORD: 'test',
            NODE_ENV: 'test',
            MINIO_ACCESS_KEY: 'minioadmin',
            MINIO_SECRET_KEY: 'minioadmin',
            CREDENTIAL_PROXY_INTERNAL_TOKEN: 'test-token-minimum-16-chars',
            TEMPORAL_ADDRESS: 'localhost:7233',
            TEMPORAL_NAMESPACE: 'default',
          }),
        ],
      }),
      MikroOrmModule.forRoot({
        driver: PostgreSqlDriver,
        host: pgContainer.getHost(),
        port: pgContainer.getPort(),
        dbName: 'test_orchestrator',
        user: 'test',
        password: 'test',
        entities: ALL_ENTITIES,
        migrations: {
          path: './libs/db/src/migrations',
          pathTs: './libs/db/src/migrations',
        },
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
    .useValue(mockTemporalClient)
    .compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const logger = await app.resolve(PinoLoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  orm = app.get(MikroORM);
  const migrator = orm.getMigrator();
  await migrator.up();

  const emFork = orm.em.fork();

  tenant = new Tenant();
  tenant.slug = 'test-tenant';
  tenant.name = 'Test Tenant';
  tenant.monthlyCostLimitUsd = 500;

  apiKeyRaw = `asdlc_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(apiKeyRaw).digest('hex');

  const apiKey = new TenantApiKey();
  apiKey.tenant = tenant;
  apiKey.keyHash = keyHash;
  apiKey.name = 'test-key';
  apiKey.role = ApiKeyRole.ADMIN;

  emFork.persist(tenant);
  emFork.persist(apiKey);
  await emFork.flush();

  return { app, orm, tenant, apiKeyRaw, mockTemporalClient };
}

export async function teardownTestApp() {
  if (orm) await orm.close(true);
  if (app) await app.close();
  if (pgContainer) await pgContainer.stop();
}

export function authHeader(key?: string) {
  return { authorization: `ApiKey ${key || apiKeyRaw}` };
}

export function getApp() { return app; }
export function getEm() { return orm.em.fork(); }
export function getTenant() { return tenant; }
export function getApiKeyRaw() { return apiKeyRaw; }
export function getOrm() { return orm; }
