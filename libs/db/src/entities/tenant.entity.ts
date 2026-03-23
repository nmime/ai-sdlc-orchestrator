import { Entity, PrimaryKey, Property, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { TenantUser } from './tenant-user.entity';
import { TenantApiKey } from './tenant-api-key.entity';
import { TenantRepoConfig } from './tenant-repo-config.entity';
import { TenantMcpServer } from './tenant-mcp-server.entity';
import { TenantVcsCredential } from './tenant-vcs-credential.entity';
import { TenantWebhookConfig } from './tenant-webhook-config.entity';

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

  @Property({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => TenantUser, (u) => u.tenant)
  users = new Collection<TenantUser>(this);

  @OneToMany(() => TenantApiKey, (k) => k.tenant)
  apiKeys = new Collection<TenantApiKey>(this);

  @OneToMany(() => TenantRepoConfig, (r) => r.tenant)
  repoConfigs = new Collection<TenantRepoConfig>(this);

  @OneToMany(() => TenantMcpServer, (m) => m.tenant)
  mcpServers = new Collection<TenantMcpServer>(this);

  @OneToMany(() => TenantVcsCredential, (v) => v.tenant)
  vcsCredentials = new Collection<TenantVcsCredential>(this);

  @OneToMany(() => TenantWebhookConfig, (w) => w.tenant)
  webhookConfigs = new Collection<TenantWebhookConfig>(this);
}
