import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum DslStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

@Entity({ tableName: 'workflow_dsl' })
export class WorkflowDsl {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  name!: string;

  @Property({ type: 'int' })
  version!: number;

  @Property({ type: 'text' })
  yamlContent!: string;

  @Property({ type: 'jsonb', nullable: true })
  compiledOutput?: Record<string, unknown>;

  @Enum(() => DslStatus)
  status: DslStatus = DslStatus.DRAFT;

  @Property({ nullable: true })
  checksum?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
