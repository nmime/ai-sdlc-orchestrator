import { Migration } from '@mikro-orm/migrations';

export class Migration20260325000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "workflow_mirror" enable row level security;`);
    this.addSql(`alter table "agent_session" enable row level security;`);
    this.addSql(`alter table "workflow_event" enable row level security;`);
    this.addSql(`alter table "workflow_artifact" enable row level security;`);
    this.addSql(`alter table "webhook_delivery" enable row level security;`);
    this.addSql(`alter table "cost_alert" enable row level security;`);
    this.addSql(`alter table "tenant_api_key" enable row level security;`);
    this.addSql(`alter table "tenant_user" enable row level security;`);
    this.addSql(`alter table "tenant_repo_config" enable row level security;`);
    this.addSql(`alter table "tenant_vcs_credential" enable row level security;`);
    this.addSql(`alter table "tenant_mcp_server" enable row level security;`);
    this.addSql(`alter table "tenant_webhook_config" enable row level security;`);
    this.addSql(`alter table "workflow_dsl" enable row level security;`);
    this.addSql(`alter table "polling_schedule" enable row level security;`);

    const tables = [
      'workflow_mirror', 'agent_session', 'workflow_event', 'workflow_artifact',
      'webhook_delivery', 'cost_alert', 'tenant_api_key', 'tenant_user',
      'tenant_repo_config', 'tenant_vcs_credential', 'tenant_mcp_server',
      'tenant_webhook_config', 'workflow_dsl', 'polling_schedule',
    ];

    for (const table of tables) {
      this.addSql(`create policy "${table}_tenant_isolation" on "${table}" using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);`);
    }

    this.addSql(`create policy "orchestrator_bypass" on "workflow_mirror" for all to "orchestrator" using (true);`);
  }

  override async down(): Promise<void> {
    const tables = [
      'workflow_mirror', 'agent_session', 'workflow_event', 'workflow_artifact',
      'webhook_delivery', 'cost_alert', 'tenant_api_key', 'tenant_user',
      'tenant_repo_config', 'tenant_vcs_credential', 'tenant_mcp_server',
      'tenant_webhook_config', 'workflow_dsl', 'polling_schedule',
    ];

    for (const table of tables) {
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`alter table "${table}" disable row level security;`);
    }

    this.addSql(`drop policy if exists "orchestrator_bypass" on "workflow_mirror";`);
  }
}
