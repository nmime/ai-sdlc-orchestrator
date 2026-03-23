import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { AgentSession } from './agent-session.entity';

export enum ToolCallStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ tableName: 'agent_tool_call' })
export class AgentToolCall {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => AgentSession)
  session!: AgentSession;

  @Property()
  toolName!: string;

  @Property({ nullable: true })
  serverName?: string;

  @Property({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown>;

  @Enum(() => ToolCallStatus)
  status: ToolCallStatus = ToolCallStatus.RUNNING;

  @Property({ type: 'int', nullable: true })
  durationMs?: number;

  @Property({ nullable: true })
  errorMessage?: string;

  @Property()
  startedAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;
}
