import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index, Unique } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum DeliveryStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  DEDUPLICATED = 'deduplicated',
  IGNORED = 'ignored',
  INVALID = 'invalid',
  FAILED = 'failed',
}

@Entity({ tableName: 'webhook_delivery' })
@Unique({ properties: ['platform', 'deliveryId'] })
export class WebhookDelivery {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  platform!: string;

  @Property()
  @Index()
  deliveryId!: string;

  @Property()
  @Index()
  eventType!: string;

  @Property({ nullable: true })
  payloadHash?: string;

  @Enum(() => DeliveryStatus)
  @Index()
  status: DeliveryStatus = DeliveryStatus.RECEIVED;

  @Property({ type: 'int', default: 0 })
  retryCount: number = 0;

  @Property({ nullable: true })
  repoId?: string;

  @Property({ nullable: true })
  repoUrl?: string;

  @Property({ nullable: true })
  workflowId?: string;

  @Property({ type: 'text', nullable: true })
  errorMessage?: string;

  @Index()
  @Property()
  createdAt: Date = new Date();
}
