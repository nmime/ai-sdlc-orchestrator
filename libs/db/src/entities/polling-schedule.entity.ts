import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';
import { TenantRepoConfig } from './tenant-repo-config.entity';

@Entity({ tableName: 'polling_schedule' })
export class PollingSchedule {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @ManyToOne(() => TenantRepoConfig)
  repoConfig!: TenantRepoConfig;

  @Property()
  platform!: string;

  @Property({ type: 'jsonb', nullable: true })
  queryFilter?: Record<string, unknown>;

  @Property({ type: 'int', default: 900 })
  pollIntervalSeconds: number = 900;

  @Property({ nullable: true })
  lastPollAt?: Date;

  @Property({ default: true })
  enabled: boolean = true;

  @Property()
  createdAt: Date = new Date();
}
