import { Migration } from '@mikro-orm/migrations';

export class Migration20260328100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table "system_settings" ("id" uuid not null, "key" varchar(255) not null, "value" text not null, "description" text null, "value_type" text not null default 'string', "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "system_settings_pkey" primary key ("id"));`);
    this.addSql(`alter table "system_settings" add constraint "system_settings_key_unique" unique ("key");`);

    this.addSql(`alter table "tenant" add column "agent_max_turns" int null;`);
    this.addSql(`alter table "tenant" add column "agent_max_duration_ms" int null;`);
    this.addSql(`alter table "tenant" add column "sandbox_timeout_ms" int null;`);
    this.addSql(`alter table "tenant" add column "ai_input_cost_per1m" numeric(10,2) null;`);
    this.addSql(`alter table "tenant" add column "ai_output_cost_per1m" numeric(10,2) null;`);
    this.addSql(`alter table "tenant" add column "budget_reservation_usd" numeric(8,2) null;`);
    this.addSql(`alter table "tenant" add column "sanitizer_mode" varchar(255) null;`);
    this.addSql(`alter table "tenant" add column "rate_limit_max" int null;`);
    this.addSql(`alter table "tenant" add column "rate_limit_window" varchar(255) null;`);
    this.addSql(`alter table "tenant" add column "webhook_max_retries" int null;`);
    this.addSql(`alter table "tenant" add column "ai_provider_configs" jsonb null;`);

    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'DEFAULT_AGENT_PROVIDER', 'auto', 'Default AI agent provider (auto = first registered)', 'string', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'AGENT_MAX_TURNS', '25', 'Maximum agent turns per task', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'AGENT_MAX_DURATION_MS', '3600000', 'Maximum agent duration in milliseconds', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'SANDBOX_TIMEOUT_MS', '600000', 'Sandbox timeout in milliseconds', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'AI_INPUT_COST_PER_1M', '3.0', 'AI input token cost per 1M tokens (USD)', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'AI_OUTPUT_COST_PER_1M', '15.0', 'AI output token cost per 1M tokens (USD)', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'BUDGET_RESERVATION_USD', '50', 'Default per-task budget reservation (USD)', 'number', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'SANITIZER_MODE', 'block', 'Prompt sanitizer mode (block/warn/off)', 'string', now(), now());`);
    this.addSql(`insert into "system_settings" ("id", "key", "value", "description", "value_type", "created_at", "updated_at") values (gen_random_uuid(), 'SANDBOX_COST_PER_HOUR_USD', '0.05', 'Sandbox hourly cost rate (USD)', 'number', now(), now());`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "system_settings";`);
    this.addSql(`alter table "tenant" drop column if exists "agent_max_turns";`);
    this.addSql(`alter table "tenant" drop column if exists "agent_max_duration_ms";`);
    this.addSql(`alter table "tenant" drop column if exists "sandbox_timeout_ms";`);
    this.addSql(`alter table "tenant" drop column if exists "ai_input_cost_per1m";`);
    this.addSql(`alter table "tenant" drop column if exists "ai_output_cost_per1m";`);
    this.addSql(`alter table "tenant" drop column if exists "budget_reservation_usd";`);
    this.addSql(`alter table "tenant" drop column if exists "sanitizer_mode";`);
    this.addSql(`alter table "tenant" drop column if exists "rate_limit_max";`);
    this.addSql(`alter table "tenant" drop column if exists "rate_limit_window";`);
    this.addSql(`alter table "tenant" drop column if exists "webhook_max_retries";`);
    this.addSql(`alter table "tenant" drop column if exists "ai_provider_configs";`);
  }
}
