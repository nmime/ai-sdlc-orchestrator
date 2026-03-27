import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
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
  @Index()
  tenant!: Tenant;

  @Enum(() => VcsProvider)
  provider!: VcsProvider;

  @Property()
  host!: string;

  @Property()
  secretRef!: string;

  @Property()
  createdAt: Date = new Date();
}
