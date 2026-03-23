import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum VcsProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
}

@Entity({ tableName: 'tenant_vcs_credential' })
export class TenantVcsCredential {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Enum(() => VcsProvider)
  provider!: VcsProvider;

  @Property()
  host!: string;

  @Property()
  tokenRef!: string;

  @Property({ nullable: true })
  label?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
