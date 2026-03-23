import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror } from './workflow-mirror.entity';
import { AgentToolCall } from './agent-tool-call.entity';

export enum SessionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

@Entity({ tableName: 'agent_session' })
export class AgentSession {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  workflow!: WorkflowMirror;

  @Property()
  agentProvider!: string;

  @Property({ nullable: true })
  sandboxId?: string;

  @Enum(() => SessionStatus)
  status: SessionStatus = SessionStatus.RUNNING;

  @Property({ type: 'int', default: 0 })
  inputTokens: number = 0;

  @Property({ type: 'int', default: 0 })
  outputTokens: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  sandboxCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  qualityScore?: number;

  @Property({ type: 'jsonb', nullable: true })
  qualityDetails?: Record<string, unknown>;

  @Property({ nullable: true })
  errorMessage?: string;

  @Property()
  startedAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;

  @OneToMany(() => AgentToolCall, (t) => t.session)
  toolCalls = new Collection<AgentToolCall>(this);
}
