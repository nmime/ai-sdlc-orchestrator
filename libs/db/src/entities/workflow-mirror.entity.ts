import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum WorkflowStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  AWAITING_GATE = 'awaiting_gate',
  AWAITING_CI = 'awaiting_ci',
  AWAITING_REVIEW = 'awaiting_review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

@Entity({ tableName: 'workflow_mirror' })
export class WorkflowMirror {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  @Index()
  temporalWorkflowId!: string;

  @Property()
  temporalRunId!: string;

  @Enum(() => WorkflowStatus)
  status: WorkflowStatus = WorkflowStatus.QUEUED;

  @Property()
  taskExternalId!: string;

  @Property()
  taskTitle!: string;

  @Property({ nullable: true })
  taskDescription?: string;

  @Property()
  repoUrl!: string;

  @Property({ nullable: true })
  branchName?: string;

  @Property({ nullable: true })
  mrUrl?: string;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  sandboxCostUsd: number = 0;

  @Property({ nullable: true })
  currentStep?: string;

  @Property({ type: 'int', default: 0 })
  retryCount: number = 0;

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  startedAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
