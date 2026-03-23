import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index, OneToMany, Collection } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';




export enum WorkflowStatus {
  QUEUED = 'queued',
  IMPLEMENTING = 'implementing',
  CI_WATCH = 'ci_watch',
  CI_PASSED = 'ci_passed',
  CI_FAILED = 'ci_failed',
  CI_FIXING = 'ci_fixing',
  IN_REVIEW = 'in_review',
  REVIEW_FIXING = 'review_fixing',
  COMPLETED = 'completed',
  BLOCKED_RECOVERABLE = 'blocked_recoverable',
  BLOCKED_TERMINAL = 'blocked_terminal',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

@Entity({ tableName: 'workflow_mirror' })
export class WorkflowMirror {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property({ unique: true })
  @Index()
  temporalWorkflowId!: string;

  @Property()
  temporalRunId!: string;

  @ManyToOne(() => WorkflowMirror, { nullable: true })
  parentWorkflow?: WorkflowMirror;

  @Property({ nullable: true })
  taskId?: string;

  @Property({ nullable: true })
  taskProvider?: string;

  @Property()
  repoId!: string;

  @Property()
  repoUrl!: string;

  @Property({ nullable: true })
  branchName?: string;

  @Property({ nullable: true })
  mrId?: string;

  @Property({ nullable: true })
  mrUrl?: string;

  @Enum(() => WorkflowStatus)
  state: WorkflowStatus = WorkflowStatus.QUEUED;

  @Property({ nullable: true })
  currentStepId?: string;

  @Property({ nullable: true })
  dslName?: string;

  @Property({ type: 'int', nullable: true })
  dslVersion?: number;

  @Property({ type: 'int', default: 0 })
  fixAttemptCount: number = 0;

  @Property({ type: 'int', default: 0 })
  reviewAttemptCount: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costUsdTotal: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costUsdReserved: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  sandboxCostUsd: number = 0;

  @Property({ type: 'jsonb', nullable: true })
  childrenStatus?: Record<string, unknown>;

  @Property({ type: 'text', nullable: true })
  errorMessage?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany('AgentSession', 'workflow')
  sessions = new Collection<any>(this);

  @OneToMany('WorkflowEvent', 'workflow')
  events = new Collection<any>(this);

  @OneToMany('WorkflowArtifact', 'workflow')
  artifacts = new Collection<any>(this);
}
