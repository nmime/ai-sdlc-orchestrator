import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum WebhookPlatform {
  JIRA = 'jira',
  GITLAB = 'gitlab',
  GITHUB = 'github',
  LINEAR = 'linear',
}

@Entity({ tableName: 'tenant_webhook_config' })
export class TenantWebhookConfig {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => WebhookPlatform)
  platform!: WebhookPlatform;

  @Property()
  externalId!: string;

  @Property({ nullable: true })
  secret?: string;

  @Property()
  targetUrl!: string;

  @Property({ default: true })
  active: boolean = true;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
