import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror } from './workflow-mirror.entity';
import type { AgentToolCall } from './agent-tool-call.entity';

export enum SessionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

export enum AgentMode {
  IMPLEMENT = 'implement',
  CI_FIX = 'ci_fix',
  REVIEW_FIX = 'review_fix',
}

export enum SessionErrorCode {
  SANDBOX_CREATE_FAILED = 'sandbox_create_failed',
  SANDBOX_TIMEOUT = 'sandbox_timeout',
  CLONE_FAILED = 'clone_failed',
  AGENT_TIMEOUT = 'agent_timeout',
  AGENT_CRASH = 'agent_crash',
  COST_LIMIT = 'cost_limit',
  TURN_LIMIT = 'turn_limit',
  CANCELLED = 'cancelled',
  CREDENTIAL_ERROR = 'credential_error',
  MCP_ERROR = 'mcp_error',
  SECURITY_VIOLATION = 'security_violation',
  NO_PROGRESS = 'no_progress',
  REGRESSION = 'regression',
  UNKNOWN = 'unknown',
}

export enum StaticAnalysisResult {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity({ tableName: 'agent_session' })
export class AgentSession {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  @Index()
  workflow!: WorkflowMirror;

  @Property()
  provider!: string;

  @Enum(() => AgentMode)
  mode!: AgentMode;

  @Property({ nullable: true })
  stepId?: string;

  @Property({ type: 'int', default: 0 })
  loopIteration: number = 0;

  @Property({ type: 'text', nullable: true })
  promptSent?: string;

  @Property({ type: 'text', nullable: true })
  agentSummary?: string;

  @Property({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown>;

  @Enum(() => SessionStatus)
  status: SessionStatus = SessionStatus.RUNNING;

  @Enum({ items: () => SessionErrorCode, nullable: true })
  errorCode?: SessionErrorCode;

  @Property({ type: 'int', default: 0 })
  inputTokens: number = 0;

  @Property({ type: 'int', default: 0 })
  outputTokens: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  aiCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  sandboxCostUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCostUsd: number = 0;

  @Property({ type: 'int', nullable: true })
  sandboxDurationSeconds?: number;

  @Property({ nullable: true })
  sandboxId?: string;

  @Property({ nullable: true })
  sandboxCreatedAt?: Date;

  @Property({ nullable: true })
  sandboxDestroyedAt?: Date;

  @Property({ nullable: true })
  model?: string;

  @Property({ type: 'int', default: 0 })
  turnCount: number = 0;

  @Property({ type: 'int', default: 0 })
  toolCallCount: number = 0;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  qualityScore?: number;

  @Property({ type: 'jsonb', nullable: true })
  qualityGatesPassed?: Record<string, boolean>;

  @Property({ type: 'int', nullable: true })
  diffLinesChanged?: number;

  @Property({ type: 'jsonb', nullable: true })
  progressIndicator?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true })
  filesModified?: string[];

  @Property({ type: 'text', nullable: true })
  testOutputSnippet?: string;

  @Enum({ items: () => StaticAnalysisResult, nullable: true })
  staticAnalysisResult?: StaticAnalysisResult;

  @Property({ type: 'text', nullable: true })
  staticAnalysisOutput?: string;

  @Property()
  startedAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;

  @OneToMany('AgentToolCall', 'session')
  toolCalls = new Collection<AgentToolCall>(this);
}
