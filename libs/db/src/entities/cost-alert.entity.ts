import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum AlertType {
  TASK_COST = 'task_cost',
  TENANT_AI = 'tenant_ai',
  TENANT_SANDBOX = 'tenant_sandbox',
  TENANT_TOTAL = 'tenant_total',
  SYSTEM = 'system',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

@Entity({ tableName: 'cost_alert' })
export class CostAlert {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => AlertType)
  type!: AlertType;

  @Enum(() => AlertStatus)
  status: AlertStatus = AlertStatus.ACTIVE;

  @Property({ type: 'decimal', precision: 10, scale: 4 })
  thresholdUsd!: number;

  @Property({ type: 'decimal', precision: 10, scale: 4 })
  currentUsd!: number;

  @Property()
  message!: string;

  @Property({ nullable: true })
  acknowledgedBy?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ nullable: true })
  acknowledgedAt?: Date;
}
