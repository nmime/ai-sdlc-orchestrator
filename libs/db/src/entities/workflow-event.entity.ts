import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror } from './workflow-mirror.entity';

@Entity({ tableName: 'workflow_event' })
export class WorkflowEvent {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  @Index()
  workflow!: WorkflowMirror;

  @Property()
  eventType!: string;

  @Property({ nullable: true })
  fromState?: string;

  @Property({ nullable: true })
  toState?: string;

  @Property({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  aiCostUsd?: number;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  sandboxCostUsd?: number;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  totalCostUsd?: number;

  @Property()
  createdAt: Date = new Date();
}
