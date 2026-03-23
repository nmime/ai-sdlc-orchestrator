import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum AgentProvider {
  CLAUDE_CODE = 'claude_code',
  OPENHANDS = 'openhands',
  AIDER = 'aider',
}

@Entity({ tableName: 'tenant_repo_config' })
export class TenantRepoConfig {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  repoUrl!: string;

  @Property({ nullable: true })
  defaultBranch?: string;

  @Enum(() => AgentProvider)
  agentProvider: AgentProvider = AgentProvider.CLAUDE_CODE;

  @Property({ type: 'jsonb', nullable: true })
  buildCommands?: string[];

  @Property({ type: 'jsonb', nullable: true })
  testCommands?: string[];

  @Property({ type: 'jsonb', nullable: true })
  lintCommands?: string[];

  @Property({ type: 'decimal', precision: 8, scale: 2, default: 50 })
  maxCostPerTaskUsd: number = 50;

  @Property({ type: 'jsonb', nullable: true })
  qualityGates?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true })
  mcpServers?: string[];

  @Property({ default: true })
  enabled: boolean = true;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
