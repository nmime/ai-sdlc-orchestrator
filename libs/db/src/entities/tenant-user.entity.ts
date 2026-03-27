import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';
import { EncryptedType } from './encrypted.type';

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
  @Index()
  tenant!: Tenant;

  @Property()
  externalId!: string;

  @Property()
  provider!: string;

  @Property({ type: EncryptedType, columnType: 'text' })
  email!: string;

  @Enum(() => TenantRole)
  role: TenantRole = TenantRole.VIEWER;

  @Property({ type: 'jsonb', nullable: true })
  repoAccess?: string[];

  @Property()
  createdAt: Date = new Date();
}
