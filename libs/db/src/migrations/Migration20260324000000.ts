import { Migration } from '@mikro-orm/migrations';

export class Migration20260324000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create index "agent_session_workflow_id_index" on "agent_session" ("workflow_id");`);
    this.addSql(`create index "agent_session_status_index" on "agent_session" ("status");`);
    this.addSql(`create index "agent_tool_call_session_id_index" on "agent_tool_call" ("session_id");`);
    this.addSql(`create index "cost_alert_tenant_id_index" on "cost_alert" ("tenant_id");`);
    this.addSql(`create index "cost_alert_created_at_index" on "cost_alert" ("created_at");`);
    this.addSql(`create index "workflow_mirror_tenant_id_index" on "workflow_mirror" ("tenant_id");`);
    this.addSql(`create index "workflow_mirror_state_index" on "workflow_mirror" ("state");`);
    this.addSql(`create index "workflow_mirror_created_at_index" on "workflow_mirror" ("created_at");`);
    this.addSql(`create index "workflow_mirror_repo_id_index" on "workflow_mirror" ("repo_id");`);
    this.addSql(`create index "workflow_artifact_workflow_id_index" on "workflow_artifact" ("workflow_id");`);
    this.addSql(`create index "workflow_event_workflow_id_index" on "workflow_event" ("workflow_id");`);
    this.addSql(`create index "workflow_event_created_at_index" on "workflow_event" ("created_at");`);
    this.addSql(`create index "webhook_delivery_tenant_id_index" on "webhook_delivery" ("tenant_id");`);
    this.addSql(`create index "webhook_delivery_status_index" on "webhook_delivery" ("status");`);
    this.addSql(`create index "webhook_delivery_created_at_index" on "webhook_delivery" ("created_at");`);
    this.addSql(`create index "polling_schedule_tenant_id_index" on "polling_schedule" ("tenant_id");`);
    this.addSql(`create index "workflow_dsl_tenant_id_index" on "workflow_dsl" ("tenant_id");`);
    this.addSql(`create index "tenant_api_key_tenant_id_index" on "tenant_api_key" ("tenant_id");`);
    this.addSql(`create index "tenant_api_key_key_hash_index" on "tenant_api_key" ("key_hash");`);
    this.addSql(`create index "tenant_user_tenant_id_index" on "tenant_user" ("tenant_id");`);
    this.addSql(`create index "tenant_user_external_id_provider_index" on "tenant_user" ("external_id", "provider");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "agent_session_workflow_id_index";`);
    this.addSql(`drop index if exists "agent_session_status_index";`);
    this.addSql(`drop index if exists "agent_tool_call_session_id_index";`);
    this.addSql(`drop index if exists "cost_alert_tenant_id_index";`);
    this.addSql(`drop index if exists "cost_alert_created_at_index";`);
    this.addSql(`drop index if exists "workflow_mirror_tenant_id_index";`);
    this.addSql(`drop index if exists "workflow_mirror_state_index";`);
    this.addSql(`drop index if exists "workflow_mirror_created_at_index";`);
    this.addSql(`drop index if exists "workflow_mirror_repo_id_index";`);
    this.addSql(`drop index if exists "workflow_artifact_workflow_id_index";`);
    this.addSql(`drop index if exists "workflow_event_workflow_id_index";`);
    this.addSql(`drop index if exists "workflow_event_created_at_index";`);
    this.addSql(`drop index if exists "webhook_delivery_tenant_id_index";`);
    this.addSql(`drop index if exists "webhook_delivery_status_index";`);
    this.addSql(`drop index if exists "webhook_delivery_created_at_index";`);
    this.addSql(`drop index if exists "polling_schedule_tenant_id_index";`);
    this.addSql(`drop index if exists "workflow_dsl_tenant_id_index";`);
    this.addSql(`drop index if exists "tenant_api_key_tenant_id_index";`);
    this.addSql(`drop index if exists "tenant_api_key_key_hash_index";`);
    this.addSql(`drop index if exists "tenant_user_tenant_id_index";`);
    this.addSql(`drop index if exists "tenant_user_external_id_provider_index";`);
  }
}
