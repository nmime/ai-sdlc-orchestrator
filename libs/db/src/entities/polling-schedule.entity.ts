import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum PollingFrequency {
  EVERY_5_MIN = '5m',
  EVERY_15_MIN = '15m',
  EVERY_30_MIN = '30m',
  EVERY_HOUR = '1h',
}

@Entity({ tableName: 'polling_schedule' })
export class PollingSchedule {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  repoUrl!: string;

  @Enum(() => PollingFrequency)
  frequency: PollingFrequency = PollingFrequency.EVERY_15_MIN;

  @Property({ nullable: true })
  lastPolledAt?: Date;

  @Property({ nullable: true })
  lastCursor?: string;

  @Property({ default: true })
  enabled: boolean = true;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
