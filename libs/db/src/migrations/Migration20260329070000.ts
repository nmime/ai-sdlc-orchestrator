import { Migration } from '@mikro-orm/migrations';

export class Migration20260329070000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "tenant_api_key" add column "last_used_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "tenant_api_key" drop column if exists "last_used_at";`);
  }
}
