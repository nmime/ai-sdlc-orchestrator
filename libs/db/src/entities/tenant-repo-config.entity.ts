import { Entity, PrimaryKey, Property, ManyToOne, Enum, Unique, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum AgentProvider {
  CLAUDE_CODE = 'claude_code',
  OPENHANDS = 'openhands',
  AIDER = 'aider',
}

export enum CloneStrategy {
  FULL = 'full',
  SPARSE = 'sparse',
  SHALLOW = 'shallow',
}

@Entity({ tableName: 'tenant_repo_config' })
@Unique({ properties: ['tenant', 'repoId'] })
export class TenantRepoConfig {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  @Index()
  tenant!: Tenant;

  @Property()
  repoId!: string;

  @Property()
  repoUrl!: string;

  @Property({ nullable: true })
  branchPrefix?: string;

  @Property({ nullable: true })
  setupCommand?: string;

  @Property({ nullable: true })
  testCommand?: string;

  @Property({ nullable: true })
  lintCommand?: string;

  @Property({ nullable: true })
  typecheckCommand?: string;

  @Property({ nullable: true })
  buildCommand?: string;

  @Property({ nullable: true })
  agentTemplateId?: string;

  @Property({ type: 'int', default: 1 })
  maxConcurrentWorkflows: number = 1;

  @Enum({ items: () => AgentProvider, nullable: true })
  agentProvider?: AgentProvider;

  @Property({ nullable: true })
  agentModel?: string;

  @Property({ type: 'jsonb', nullable: true })
  modelRouting?: Record<string, string>;

  @Property({ type: 'decimal', precision: 8, scale: 2, default: 5 })
  costLimitUsd: number = 5;

  @Property({ type: 'jsonb', nullable: true })
  costTiers?: Record<string, number>;

  @Property({ type: 'int', nullable: true })
  maxDiffLines?: number;

  @Property({ type: 'jsonb', nullable: true })
  allowedPaths?: string[];

  @Property({ nullable: true })
  commitMessagePattern?: string;

  @Property({ type: 'text', nullable: true })
  mrDescriptionTemplate?: string;

  @Property({ type: 'jsonb', nullable: true })
  qualityGateCommands?: string[];

  @Property({ nullable: true })
  staticAnalysisCommand?: string;

  @Enum({ items: () => CloneStrategy, nullable: true })
  cloneStrategy?: CloneStrategy;

  @Property({ type: 'jsonb', nullable: true })
  sparseCheckoutPaths?: string[];

  @Property({ type: 'jsonb', nullable: true })
  concurrencyHints?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}
