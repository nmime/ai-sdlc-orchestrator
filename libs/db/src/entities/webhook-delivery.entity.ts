import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';
import { WebhookPlatform } from './tenant-webhook-config.entity';

export enum DeliveryStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  IGNORED = 'ignored',
  FAILED = 'failed',
}

@Entity({ tableName: 'webhook_delivery' })
export class WebhookDelivery {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => WebhookPlatform)
  platform!: WebhookPlatform;

  @Property()
  @Index()
  eventType!: string;

  @Property({ unique: true })
  idempotencyKey!: string;

  @Property({ type: 'jsonb' })
  headers!: Record<string, string>;

  @Property({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Enum(() => DeliveryStatus)
  status: DeliveryStatus = DeliveryStatus.RECEIVED;

  @Property({ nullable: true })
  temporalWorkflowId?: string;

  @Property({ nullable: true })
  errorMessage?: string;

  @Property()
  receivedAt: Date = new Date();

  @Property({ nullable: true })
  processedAt?: Date;
}
