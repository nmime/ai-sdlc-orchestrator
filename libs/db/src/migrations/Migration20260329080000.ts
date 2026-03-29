import { Migration } from '@mikro-orm/migrations';

export class Migration20260329080000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table "tenant_subscription" ("id" uuid not null, "tenant_id" uuid not null, "plan" text check ("plan" in ('starter', 'pro', 'enterprise')) not null default 'starter', "status" text check ("status" in ('active', 'trialing', 'past_due', 'cancelled', 'paused')) not null default 'active', "stripe_customer_id" varchar(255) null, "stripe_subscription_id" varchar(255) null, "monthly_price_usd" numeric(10,2) not null default 0, "current_period_start" timestamptz null, "current_period_end" timestamptz null, "cancelled_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "tenant_subscription_pkey" primary key ("id"));`);
    this.addSql(`create index "tenant_subscription_tenant_id_index" on "tenant_subscription" ("tenant_id");`);
    this.addSql(`alter table "tenant_subscription" add constraint "tenant_subscription_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "tenant_subscription";`);
  }
}
