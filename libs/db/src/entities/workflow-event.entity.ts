import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror, WorkflowStatus } from './workflow-mirror.entity';

@Entity({ tableName: 'workflow_event' })
export class WorkflowEvent {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  workflow!: WorkflowMirror;

  @Enum(() => WorkflowStatus)
  fromStatus!: WorkflowStatus;

  @Enum(() => WorkflowStatus)
  toStatus!: WorkflowStatus;

  @Property({ nullable: true })
  step?: string;

  @Property({ nullable: true })
  reason?: string;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  costUsd?: number;

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}
