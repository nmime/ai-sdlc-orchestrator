import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index, Unique } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum WebhookPlatform {
  JIRA = 'jira',
  GITLAB = 'gitlab',
  GITHUB = 'github',
  LINEAR = 'linear',
}

export enum WebhookConfigStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ tableName: 'tenant_webhook_config' })
@Index({ properties: ['tenant'] })
@Unique({ properties: ['tenant', 'platform'] })
export class TenantWebhookConfig {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => WebhookPlatform)
  platform!: WebhookPlatform;

  @Property({ nullable: true })
  webhookId?: string;

  @Property({ nullable: true })
  webhookUrl?: string;

  @Enum(() => WebhookConfigStatus)
  status: WebhookConfigStatus = WebhookConfigStatus.ACTIVE;

  @Property({ nullable: true })
  secretRef?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
