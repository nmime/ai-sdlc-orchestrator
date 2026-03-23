import { Entity, PrimaryKey, Property, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';

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

  @OneToMany('TenantUser', 'tenant')
  users = new Collection<any>(this);

  @OneToMany('TenantApiKey', 'tenant')
  apiKeys = new Collection<any>(this);

  @OneToMany('TenantRepoConfig', 'tenant')
  repoConfigs = new Collection<any>(this);

  @OneToMany('TenantMcpServer', 'tenant')
  mcpServers = new Collection<any>(this);

  @OneToMany('TenantVcsCredential', 'tenant')
  vcsCredentials = new Collection<any>(this);

  @OneToMany('TenantWebhookConfig', 'tenant')
  webhookConfigs = new Collection<any>(this);
}
