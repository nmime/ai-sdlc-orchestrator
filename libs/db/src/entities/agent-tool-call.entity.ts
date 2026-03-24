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

  @Property({ type: 'int' })
  sequenceNumber!: number;

  @Property()
  toolName!: string;

  @Property({ type: 'jsonb', nullable: true })
  inputSummary?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true })
  outputSummary?: Record<string, unknown>;

  @Enum(() => ToolCallStatus)
  status: ToolCallStatus = ToolCallStatus.RUNNING;

  @Property({ type: 'int', nullable: true })
  durationMs?: number;

  @Property()
  createdAt: Date = new Date();
}
