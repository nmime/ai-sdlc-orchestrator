import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

@Entity({ tableName: 'tenant_api_key' })
export class TenantApiKey {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  label!: string;

  @Property()
  keyHash!: string;

  @Property()
  keyPrefix!: string;

  @Property({ type: 'jsonb', nullable: true })
  scopes?: string[];

  @Property({ nullable: true })
  expiresAt?: Date;

  @Property({ nullable: true })
  lastUsedAt?: Date;

  @Property({ default: true })
  active: boolean = true;

  @Property()
  createdAt: Date = new Date();
}
