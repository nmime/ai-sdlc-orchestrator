import { Entity, PrimaryKey, Property, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

@Entity({ tableName: 'workflow_dsl' })
@Unique({ properties: ['tenant', 'name', 'version'] })
export class WorkflowDsl {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  @Index()
  tenant!: Tenant;

  @Property()
  name!: string;

  @Property({ type: 'int' })
  version!: number;

  @Property({ type: 'jsonb' })
  definition!: Record<string, unknown>;

  @Property({ default: true })
  isActive: boolean = true;

  @Property()
  createdAt: Date = new Date();
}
