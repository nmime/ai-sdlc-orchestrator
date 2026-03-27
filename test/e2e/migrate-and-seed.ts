import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { v4 as uuid } from 'uuid';
import {
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, TenantUser, TenantWebhookConfig, WebhookDelivery,
  WorkflowMirror, WorkflowEvent, WorkflowDsl, WorkflowArtifact,
  AgentSession, AgentToolCall, CostAlert, PollingSchedule, McpServerRegistry,
  WorkflowStatus,
} from '@ai-sdlc/db';

const DEV_TENANT_ID = '00000000-0000-4000-a000-000000000001';

const ALL_ENTITIES = [
  Tenant, TenantMcpServer, TenantVcsCredential, TenantRepoConfig,
  TenantApiKey, TenantUser, TenantWebhookConfig, WebhookDelivery,
  WorkflowMirror, WorkflowEvent, WorkflowDsl, WorkflowArtifact,
  AgentSession, AgentToolCall, CostAlert, PollingSchedule, McpServerRegistry,
];

function createWorkflow(tenant: Tenant, state: WorkflowStatus, repoUrl: string, cost: string, dslName: string): WorkflowMirror {
  const wf = new WorkflowMirror();
  wf.tenant = tenant;
  wf.repoUrl = repoUrl;
  wf.repoId = repoUrl;
  wf.state = state;
  wf.temporalWorkflowId = `wf-${uuid()}`;
  wf.temporalRunId = `run-${uuid()}`;
  wf.costUsdTotal = Number(cost);
  wf.dslName = dslName;
  return wf;
}

async function main() {
  const orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    dbName: process.env.DATABASE_NAME || 'test_e2e',
    user: process.env.DATABASE_USER || 'test',
    password: process.env.DATABASE_PASSWORD || 'test',
    entities: ALL_ENTITIES,
    migrations: {
      path: './libs/db/src/migrations',
      pathTs: './libs/db/src/migrations',
    },
    allowGlobalContext: true,
    debug: false,
  });

  console.log('[seed] Running migrations...');
  await orm.getMigrator().up();

  console.log('[seed] Seeding test data...');
  const em = orm.em.fork();

  const tenant = new Tenant();
  tenant.id = DEV_TENANT_ID;
  tenant.slug = 'dev-tenant';
  tenant.name = 'Dev Tenant';
  tenant.monthlyCostLimitUsd = 1000;
  tenant.monthlyCostActualUsd = '150.50';
  tenant.monthlyAiCostActualUsd = '100.25';
  tenant.monthlySandboxCostActualUsd = '50.25';
  em.persist(tenant);

  em.persist(createWorkflow(tenant, WorkflowStatus.IMPLEMENTING, 'https://github.com/example/repo', '45.00', 'Implement user authentication'));
  em.persist(createWorkflow(tenant, WorkflowStatus.COMPLETED, 'https://github.com/example/repo', '12.50', 'Fix login page CSS'));
  em.persist(createWorkflow(tenant, WorkflowStatus.QUEUED, 'https://github.com/example/payments', '0.00', 'Add payment integration'));

  await em.flush();
  console.log('[seed] Done: 1 tenant, 3 workflows');

  await orm.close(true);
}

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
