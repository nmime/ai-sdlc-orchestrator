import { Entity, PrimaryKey, Property, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import type { TenantUser } from './tenant-user.entity';
import type { TenantApiKey } from './tenant-api-key.entity';
import type { TenantRepoConfig } from './tenant-repo-config.entity';
import type { TenantMcpServer } from './tenant-mcp-server.entity';
import type { TenantVcsCredential } from './tenant-vcs-credential.entity';
import type { TenantWebhookConfig } from './tenant-webhook-config.entity';

export enum TenantStatus {
  PENDING = 'pending',
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  DELETED = 'deleted',
}

export enum McpServerPolicy {
  CURATED = 'curated',
  OPEN = 'open',
}

@Entity({ tableName: 'tenant' })
export class Tenant {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @Property({ unique: true })
  slug!: string;

  @Property()
  name!: string;

  @Enum(() => TenantStatus)
  status: TenantStatus = TenantStatus.ACTIVE;

  @Property({ nullable: true })
  temporalNamespace?: string;

  @Property({ type: 'int', default: 10 })
  maxConcurrentWorkflows: number = 10;

  @Property({ type: 'int', default: 5 })
  maxConcurrentSandboxes: number = 5;

  @Property({ type: 'decimal', precision: 12, scale: 2, default: 500 })
  monthlyCostLimitUsd: number = 500;

  @Property({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyCostReservedUsd: number = 0;

  @Property({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyCostActualUsd: number = 0;

  @Property({ nullable: true })
  defaultAgentProvider?: string;

  @Property({ nullable: true })
  defaultAgentModel?: string;

  @Property({ type: 'jsonb', nullable: true })
  agentProviderApiKeyRefs?: Record<string, string>;

  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyAiCostLimitUsd?: number;

  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlySandboxCostLimitUsd?: number;

  @Property({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyAiCostActualUsd: number = 0;

  @Property({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlySandboxCostActualUsd: number = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: 0.05 })
  sandboxHourlyRateUsd: number = 0.05;

  @Property({ type: 'jsonb', nullable: true })
  costAlertThresholds?: number[];

  @Property({ type: 'int', default: 0 })
  budgetVersion: number = 0;

  @Enum(() => McpServerPolicy)
  mcpServerPolicy: McpServerPolicy = McpServerPolicy.CURATED;

  @Property({ type: 'int', nullable: true })
  agentMaxTurns?: number;

  @Property({ type: 'int', nullable: true })
  agentMaxDurationMs?: number;

  @Property({ type: 'int', nullable: true })
  sandboxTimeoutMs?: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  aiInputCostPer1m?: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  aiOutputCostPer1m?: number;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  budgetReservationUsd?: number;

  @Property({ nullable: true })
  sanitizerMode?: string;

  @Property({ type: 'int', nullable: true })
  rateLimitMax?: number;

  @Property({ nullable: true })
  rateLimitWindow?: string;

  @Property({ type: 'int', nullable: true })
  webhookMaxRetries?: number;

  @Property({ type: 'jsonb', nullable: true })
  aiProviderConfigs?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany('TenantUser', 'tenant')
  users = new Collection<TenantUser>(this);

  @OneToMany('TenantApiKey', 'tenant')
  apiKeys = new Collection<TenantApiKey>(this);

  @OneToMany('TenantRepoConfig', 'tenant')
  repoConfigs = new Collection<TenantRepoConfig>(this);

  @OneToMany('TenantMcpServer', 'tenant')
  mcpServers = new Collection<TenantMcpServer>(this);

  @OneToMany('TenantVcsCredential', 'tenant')
  vcsCredentials = new Collection<TenantVcsCredential>(this);

  @OneToMany('TenantWebhookConfig', 'tenant')
  webhookConfigs = new Collection<TenantWebhookConfig>(this);
}
