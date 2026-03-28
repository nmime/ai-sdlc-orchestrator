import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum AlertType {
  TASK_COST = 'task_cost',
  TENANT_AI = 'tenant_ai',
  TENANT_SANDBOX = 'tenant_sandbox',
  TENANT_TOTAL = 'tenant_total',
  SYSTEM = 'system',
}

@Entity({ tableName: 'cost_alert' })
export class CostAlert {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  @Index()
  tenant!: Tenant;

  @Enum(() => AlertType)
  alertType!: AlertType;

  @Property({ type: 'decimal', precision: 5, scale: 2 })
  thresholdPct!: number;

  @Property({ type: 'decimal', precision: 10, scale: 4 })
  actualUsd!: number;

  @Property({ type: 'decimal', precision: 10, scale: 4 })
  limitUsd!: number;

  @Property({ default: false })
  acknowledged: boolean = false;

  @Index()
  @Property()
  createdAt: Date = new Date();

  @Property({ nullable: true })
  acknowledgedAt?: Date;
}
