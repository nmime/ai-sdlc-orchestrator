import { EntityManager } from '@mikro-orm/postgresql';
import { Tenant } from './entities/tenant.entity';
import { WorkflowDsl } from './entities/workflow-dsl.entity';

export async function seedDatabase(em: EntityManager): Promise<void> {
  const existing = await em.findOne(Tenant, { slug: 'default' });
  if (existing) return;

  const tenant = new Tenant();
  tenant.slug = 'default';
  tenant.name = 'Default Tenant';
  tenant.monthlyCostLimitUsd = 500;
  em.persist(tenant);

  const dsl = new WorkflowDsl();
  dsl.tenant = tenant;
  dsl.name = 'standard-workflow';
  dsl.version = 1;
  dsl.definition = {
    version: 1,
    name: 'standard-workflow',
    taskQueue: 'orchestrator-queue',
    timeout_minutes: 240,
    steps: [
      { id: 'implement', type: 'auto', mode: 'implement', timeout_minutes: 60 },
      { id: 'ci_watch', type: 'signal_wait', signal: 'ci_result', timeout_minutes: 120 },
      { id: 'review_gate', type: 'gate', timeout_minutes: 1440 },
    ],
  };
  dsl.isActive = true;
  em.persist(dsl);

  await em.flush();
}
