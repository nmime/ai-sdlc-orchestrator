import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum TenantRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

@Entity({ tableName: 'tenant_user' })
export class TenantUser {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  externalId!: string;

  @Property()
  email!: string;

  @Property({ nullable: true })
  displayName?: string;

  @Enum(() => TenantRole)
  role: TenantRole = TenantRole.VIEWER;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
