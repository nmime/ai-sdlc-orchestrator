import { Migration } from '@mikro-orm/migrations';

export class Migration20260323191337 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "mcp_server_registry" ("id" uuid not null, "name" varchar(255) not null, "description" text null, "protocol_version" varchar(255) null, "scoping_capability" varchar(255) null, "is_verified" boolean not null default false, "default_config" jsonb null, "created_at" timestamptz not null, constraint "mcp_server_registry_pkey" primary key ("id"));`);
    this.addSql(`alter table "mcp_server_registry" add constraint "mcp_server_registry_name_unique" unique ("name");`);

    this.addSql(`create table "tenant" ("id" uuid not null, "slug" varchar(255) not null, "name" varchar(255) not null, "status" text check ("status" in ('pending', 'provisioning', 'active', 'suspended', 'deactivating', 'deactivated', 'deleted')) not null default 'active', "temporal_namespace" varchar(255) null, "max_concurrent_workflows" int not null default 10, "max_concurrent_sandboxes" int not null default 5, "monthly_cost_limit_usd" numeric(12,2) not null default 500, "monthly_cost_reserved_usd" numeric(12,2) not null default 0, "monthly_cost_actual_usd" numeric(12,2) not null default 0, "default_agent_provider" varchar(255) null, "default_agent_model" varchar(255) null, "agent_provider_api_key_refs" jsonb null, "monthly_ai_cost_limit_usd" numeric(12,2) null, "monthly_sandbox_cost_limit_usd" numeric(12,2) null, "monthly_ai_cost_actual_usd" numeric(12,2) not null default 0, "monthly_sandbox_cost_actual_usd" numeric(12,2) not null default 0, "sandbox_hourly_rate_usd" numeric(10,4) not null default 0.05, "cost_alert_thresholds" jsonb null, "budget_version" int not null default 0, "mcp_server_policy" text check ("mcp_server_policy" in ('curated', 'open')) not null default 'curated', "meta" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "tenant_pkey" primary key ("id"));`);
    this.addSql(`alter table "tenant" add constraint "tenant_slug_unique" unique ("slug");`);

    this.addSql(`create table "cost_alert" ("id" uuid not null, "tenant_id" uuid not null, "alert_type" text check ("alert_type" in ('task_cost', 'tenant_ai', 'tenant_sandbox', 'tenant_total', 'system')) not null, "threshold_pct" numeric(5,2) not null, "actual_usd" numeric(10,4) not null, "limit_usd" numeric(10,4) not null, "acknowledged" boolean not null default false, "created_at" timestamptz not null, "acknowledged_at" timestamptz null, constraint "cost_alert_pkey" primary key ("id"));`);

    this.addSql(`create table "tenant_api_key" ("id" uuid not null, "tenant_id" uuid not null, "key_hash" varchar(255) not null, "name" varchar(255) not null, "role" text check ("role" in ('admin', 'operator', 'viewer')) not null default 'viewer', "expires_at" timestamptz null, "created_at" timestamptz not null, constraint "tenant_api_key_pkey" primary key ("id"));`);

    this.addSql(`create table "tenant_mcp_server" ("id" uuid not null, "tenant_id" uuid not null, "name" varchar(255) not null, "transport" text check ("transport" in ('stdio', 'sse', 'streamable_http')) not null, "url" varchar(255) null, "command" varchar(255) null, "args" jsonb null, "headers_secret_ref" jsonb null, "env_secret_ref" jsonb null, "is_enabled" boolean not null default true, "created_at" timestamptz not null, constraint "tenant_mcp_server_pkey" primary key ("id"));`);
    this.addSql(`alter table "tenant_mcp_server" add constraint "tenant_mcp_server_tenant_id_name_unique" unique ("tenant_id", "name");`);

    this.addSql(`create table "tenant_repo_config" ("id" uuid not null, "tenant_id" uuid not null, "repo_id" varchar(255) not null, "repo_url" varchar(255) not null, "branch_prefix" varchar(255) null, "setup_command" varchar(255) null, "test_command" varchar(255) null, "lint_command" varchar(255) null, "typecheck_command" varchar(255) null, "build_command" varchar(255) null, "agent_template_id" varchar(255) null, "max_concurrent_workflows" int not null default 1, "agent_provider" text check ("agent_provider" in ('claude_code', 'openhands', 'aider')) null, "agent_model" varchar(255) null, "model_routing" jsonb null, "cost_limit_usd" numeric(8,2) not null default 5, "cost_tiers" jsonb null, "max_diff_lines" int null, "allowed_paths" jsonb null, "commit_message_pattern" varchar(255) null, "mr_description_template" text null, "quality_gate_commands" jsonb null, "static_analysis_command" varchar(255) null, "clone_strategy" text check ("clone_strategy" in ('full', 'sparse', 'shallow')) null, "sparse_checkout_paths" jsonb null, "concurrency_hints" jsonb null, "created_at" timestamptz not null, constraint "tenant_repo_config_pkey" primary key ("id"));`);
    this.addSql(`alter table "tenant_repo_config" add constraint "tenant_repo_config_tenant_id_repo_id_unique" unique ("tenant_id", "repo_id");`);

    this.addSql(`create table "polling_schedule" ("id" uuid not null, "tenant_id" uuid not null, "repo_config_id" uuid not null, "platform" varchar(255) not null, "query_filter" jsonb null, "poll_interval_seconds" int not null default 900, "last_poll_at" timestamptz null, "enabled" boolean not null default true, "created_at" timestamptz not null, constraint "polling_schedule_pkey" primary key ("id"));`);

    this.addSql(`create table "tenant_user" ("id" uuid not null, "tenant_id" uuid not null, "external_id" varchar(255) not null, "provider" varchar(255) not null, "email" varchar(255) not null, "role" text check ("role" in ('admin', 'operator', 'viewer')) not null default 'viewer', "repo_access" jsonb null, "created_at" timestamptz not null, constraint "tenant_user_pkey" primary key ("id"));`);

    this.addSql(`create table "tenant_vcs_credential" ("id" uuid not null, "tenant_id" uuid not null, "provider" text check ("provider" in ('github', 'gitlab', 'bitbucket')) not null, "host" varchar(255) not null, "secret_ref" varchar(255) not null, "created_at" timestamptz not null, constraint "tenant_vcs_credential_pkey" primary key ("id"));`);

    this.addSql(`create table "tenant_webhook_config" ("id" uuid not null, "tenant_id" uuid not null, "platform" text check ("platform" in ('jira', 'gitlab', 'github', 'linear')) not null, "webhook_id" varchar(255) null, "webhook_url" varchar(255) null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "secret_ref" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "tenant_webhook_config_pkey" primary key ("id"));`);

    this.addSql(`create table "webhook_delivery" ("id" uuid not null, "tenant_id" uuid not null, "platform" varchar(255) not null, "delivery_id" varchar(255) not null, "event_type" varchar(255) not null, "payload_hash" varchar(255) null, "status" text check ("status" in ('received', 'processing', 'processed', 'deduplicated', 'ignored', 'invalid', 'failed')) not null default 'received', "workflow_id" varchar(255) null, "error_message" text null, "created_at" timestamptz not null, constraint "webhook_delivery_pkey" primary key ("id"));`);
    this.addSql(`create index "webhook_delivery_delivery_id_index" on "webhook_delivery" ("delivery_id");`);
    this.addSql(`create index "webhook_delivery_event_type_index" on "webhook_delivery" ("event_type");`);
    this.addSql(`alter table "webhook_delivery" add constraint "webhook_delivery_platform_delivery_id_unique" unique ("platform", "delivery_id");`);

    this.addSql(`create table "workflow_dsl" ("id" uuid not null, "tenant_id" uuid not null, "name" varchar(255) not null, "version" int not null, "definition" jsonb not null, "is_active" boolean not null default true, "created_at" timestamptz not null, constraint "workflow_dsl_pkey" primary key ("id"));`);
    this.addSql(`alter table "workflow_dsl" add constraint "workflow_dsl_tenant_id_name_version_unique" unique ("tenant_id", "name", "version");`);

    this.addSql(`create table "workflow_mirror" ("id" uuid not null, "tenant_id" uuid not null, "temporal_workflow_id" varchar(255) not null, "temporal_run_id" varchar(255) not null, "parent_workflow_id" uuid null, "task_id" varchar(255) null, "task_provider" varchar(255) null, "repo_id" varchar(255) not null, "repo_url" varchar(255) not null, "branch_name" varchar(255) null, "mr_id" varchar(255) null, "mr_url" varchar(255) null, "state" text check ("state" in ('queued', 'implementing', 'ci_watch', 'ci_passed', 'ci_failed', 'ci_fixing', 'in_review', 'review_fixing', 'completed', 'blocked_recoverable', 'blocked_terminal', 'cancelled', 'timed_out')) not null default 'queued', "current_step_id" varchar(255) null, "dsl_name" varchar(255) null, "dsl_version" int null, "fix_attempt_count" int not null default 0, "review_attempt_count" int not null default 0, "cost_usd_total" numeric(10,4) not null default 0, "cost_usd_reserved" numeric(10,4) not null default 0, "ai_cost_usd" numeric(10,4) not null default 0, "sandbox_cost_usd" numeric(10,4) not null default 0, "children_status" jsonb null, "error_message" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "workflow_mirror_pkey" primary key ("id"));`);
    this.addSql(`create index "workflow_mirror_temporal_workflow_id_index" on "workflow_mirror" ("temporal_workflow_id");`);
    this.addSql(`alter table "workflow_mirror" add constraint "workflow_mirror_temporal_workflow_id_unique" unique ("temporal_workflow_id");`);

    this.addSql(`create table "workflow_event" ("id" uuid not null, "workflow_id" uuid not null, "event_type" varchar(255) not null, "from_state" varchar(255) null, "to_state" varchar(255) null, "payload" jsonb null, "ai_cost_usd" numeric(10,4) null, "sandbox_cost_usd" numeric(10,4) null, "total_cost_usd" numeric(10,4) null, "created_at" timestamptz not null, constraint "workflow_event_pkey" primary key ("id"));`);

    this.addSql(`create table "agent_session" ("id" uuid not null, "workflow_id" uuid not null, "provider" varchar(255) not null, "mode" text check ("mode" in ('implement', 'ci_fix', 'review_fix')) not null, "step_id" varchar(255) null, "loop_iteration" int not null default 0, "prompt_sent" text null, "agent_summary" text null, "result" jsonb null, "status" text check ("status" in ('running', 'completed', 'failed', 'cancelled', 'timed_out')) not null default 'running', "error_code" text check ("error_code" in ('sandbox_create_failed', 'sandbox_timeout', 'clone_failed', 'agent_timeout', 'agent_crash', 'cost_limit', 'turn_limit', 'cancelled', 'credential_error', 'mcp_error', 'security_violation', 'no_progress', 'regression', 'unknown')) null, "input_tokens" int not null default 0, "output_tokens" int not null default 0, "ai_cost_usd" numeric(10,4) not null default 0, "sandbox_cost_usd" numeric(10,4) not null default 0, "total_cost_usd" numeric(10,4) not null default 0, "sandbox_duration_seconds" int null, "sandbox_id" varchar(255) null, "sandbox_created_at" timestamptz null, "sandbox_destroyed_at" timestamptz null, "model" varchar(255) null, "turn_count" int not null default 0, "tool_call_count" int not null default 0, "quality_score" numeric(5,2) null, "quality_gates_passed" jsonb null, "diff_lines_changed" int null, "progress_indicator" jsonb null, "files_modified" jsonb null, "test_output_snippet" text null, "static_analysis_result" text check ("static_analysis_result" in ('passed', 'failed', 'skipped')) null, "static_analysis_output" text null, "started_at" timestamptz not null, "completed_at" timestamptz null, constraint "agent_session_pkey" primary key ("id"));`);

    this.addSql(`create table "workflow_artifact" ("id" uuid not null, "workflow_id" uuid not null, "session_id" uuid null, "tenant_id" uuid not null, "step_id" varchar(255) null, "kind" text check ("kind" in ('merge_request', 'design', 'document', 'report', 'image', 'test_report', 'build_output', 'other')) not null, "title" varchar(255) not null, "uri" varchar(255) not null, "mime_type" varchar(255) null, "preview_url" varchar(255) null, "metadata" jsonb null, "content" text null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "created_at" timestamptz not null, constraint "workflow_artifact_pkey" primary key ("id"));`);

    this.addSql(`create table "agent_tool_call" ("id" uuid not null, "session_id" uuid not null, "sequence_number" int not null, "tool_name" varchar(255) not null, "input_summary" jsonb null, "output_summary" jsonb null, "status" text check ("status" in ('running', 'completed', 'failed')) not null default 'running', "duration_ms" int null, "created_at" timestamptz not null, constraint "agent_tool_call_pkey" primary key ("id"));`);

    this.addSql(`alter table "cost_alert" add constraint "cost_alert_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_api_key" add constraint "tenant_api_key_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_mcp_server" add constraint "tenant_mcp_server_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_repo_config" add constraint "tenant_repo_config_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "polling_schedule" add constraint "polling_schedule_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);
    this.addSql(`alter table "polling_schedule" add constraint "polling_schedule_repo_config_id_foreign" foreign key ("repo_config_id") references "tenant_repo_config" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_user" add constraint "tenant_user_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_vcs_credential" add constraint "tenant_vcs_credential_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "tenant_webhook_config" add constraint "tenant_webhook_config_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "webhook_delivery" add constraint "webhook_delivery_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "workflow_dsl" add constraint "workflow_dsl_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "workflow_mirror" add constraint "workflow_mirror_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);
    this.addSql(`alter table "workflow_mirror" add constraint "workflow_mirror_parent_workflow_id_foreign" foreign key ("parent_workflow_id") references "workflow_mirror" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "workflow_event" add constraint "workflow_event_workflow_id_foreign" foreign key ("workflow_id") references "workflow_mirror" ("id") on update cascade;`);

    this.addSql(`alter table "agent_session" add constraint "agent_session_workflow_id_foreign" foreign key ("workflow_id") references "workflow_mirror" ("id") on update cascade;`);

    this.addSql(`alter table "workflow_artifact" add constraint "workflow_artifact_workflow_id_foreign" foreign key ("workflow_id") references "workflow_mirror" ("id") on update cascade;`);
    this.addSql(`alter table "workflow_artifact" add constraint "workflow_artifact_session_id_foreign" foreign key ("session_id") references "agent_session" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "workflow_artifact" add constraint "workflow_artifact_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);

    this.addSql(`alter table "agent_tool_call" add constraint "agent_tool_call_session_id_foreign" foreign key ("session_id") references "agent_session" ("id") on update cascade;`);
  }

}
