import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum ApiKeyRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

@Entity({ tableName: 'tenant_api_key' })
export class TenantApiKey {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  keyHash!: string;

  @Property()
  name!: string;

  @Enum(() => ApiKeyRole)
  role: ApiKeyRole = ApiKeyRole.VIEWER;

  @Property({ nullable: true })
  expiresAt?: Date;

  @Property()
  createdAt: Date = new Date();
}
