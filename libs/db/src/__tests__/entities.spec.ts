import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { TenantUser, TenantRole } from '../entities/tenant-user.entity';
import { TenantApiKey, ApiKeyRole } from '../entities/tenant-api-key.entity';
import { TenantRepoConfig, CloneStrategy } from '../entities/tenant-repo-config.entity';
import { WebhookDelivery, DeliveryStatus } from '../entities/webhook-delivery.entity';
import { WorkflowMirror, WorkflowStatus } from '../entities/workflow-mirror.entity';
import { WorkflowDsl } from '../entities/workflow-dsl.entity';
import { AgentSession, SessionStatus } from '../entities/agent-session.entity';
import { AgentToolCall, ToolCallStatus } from '../entities/agent-tool-call.entity';
import { CostAlert } from '../entities/cost-alert.entity';
import { PollingSchedule } from '../entities/polling-schedule.entity';
import { McpServerRegistry } from '../entities/mcp-server-registry.entity';

describe('Entity defaults', () => {
  it('Tenant should have correct defaults', () => {
    const tenant = new Tenant();
    expect(tenant.id).toBeDefined();
    expect(tenant.status).toBe(TenantStatus.ACTIVE);
    expect(tenant.monthlyCostLimitUsd).toBe(500);
    expect(tenant.monthlyCostReservedUsd).toBe(0);
    expect(tenant.monthlyCostActualUsd).toBe(0);
    expect(tenant.budgetVersion).toBe(0);
    expect(tenant.createdAt).toBeInstanceOf(Date);
  });

  it('TenantUser should default to VIEWER role', () => {
    const user = new TenantUser();
    expect(user.role).toBe(TenantRole.VIEWER);
  });

  it('TenantApiKey should default to VIEWER role', () => {
    const key = new TenantApiKey();
    expect(key.role).toBe(ApiKeyRole.VIEWER);
  });

  it('TenantRepoConfig should default to costLimitUsd 5', () => {
    const config = new TenantRepoConfig();
    expect(config.costLimitUsd).toBe(5);
    expect(config.maxConcurrentWorkflows).toBe(1);
    expect(config.createdAt).toBeInstanceOf(Date);
  });

  it('TenantRepoConfig agentProvider is string-based (not enum)', () => {
    const config = new TenantRepoConfig();
    config.agentProvider = 'custom-provider-v2';
    expect(config.agentProvider).toBe('custom-provider-v2');
  });

  it('WebhookDelivery should default to RECEIVED', () => {
    const delivery = new WebhookDelivery();
    expect(delivery.status).toBe(DeliveryStatus.RECEIVED);
  });

  it('WorkflowMirror should default to QUEUED', () => {
    const mirror = new WorkflowMirror();
    expect(mirror.state).toBe(WorkflowStatus.QUEUED);
    expect(mirror.costUsdTotal).toBe(0);
    expect(mirror.fixAttemptCount).toBe(0);
  });

  it('WorkflowDsl should default to isActive true', () => {
    const dsl = new WorkflowDsl();
    expect(dsl.isActive).toBe(true);
  });

  it('AgentSession should default to RUNNING', () => {
    const session = new AgentSession();
    expect(session.status).toBe(SessionStatus.RUNNING);
    expect(session.inputTokens).toBe(0);
    expect(session.outputTokens).toBe(0);
  });

  it('AgentToolCall should default to RUNNING', () => {
    const call = new AgentToolCall();
    expect(call.status).toBe(ToolCallStatus.RUNNING);
  });

  it('CostAlert should default to acknowledged false', () => {
    const alert = new CostAlert();
    expect(alert.acknowledged).toBe(false);
  });

  it('PollingSchedule should default to 900s interval', () => {
    const schedule = new PollingSchedule();
    expect(schedule.pollIntervalSeconds).toBe(900);
    expect(schedule.enabled).toBe(true);
  });

  it('McpServerRegistry should default to isVerified false', () => {
    const registry = new McpServerRegistry();
    expect(registry.isVerified).toBe(false);
  });
});

describe('Entity enums', () => {
  it('TenantStatus should have all values', () => {
    expect(Object.values(TenantStatus)).toEqual([
      'pending', 'provisioning', 'active', 'suspended', 'deactivating', 'deactivated', 'deleted',
    ]);
  });

  it('TenantRole should have all values', () => {
    expect(Object.values(TenantRole)).toEqual(['admin', 'operator', 'viewer']);
  });

  it('WorkflowStatus should have all values', () => {
    expect(Object.values(WorkflowStatus)).toEqual([
      'queued', 'implementing', 'ci_watch', 'ci_passed', 'ci_failed',
      'ci_fixing', 'in_review', 'review_fixing', 'completed',
      'blocked_recoverable', 'blocked_terminal', 'cancelled', 'timed_out',
    ]);
  });

  it('CloneStrategy should have all values', () => {
    expect(Object.values(CloneStrategy)).toEqual(['full', 'sparse', 'shallow']);
  });

  it('SessionStatus should have all values', () => {
    expect(Object.values(SessionStatus)).toEqual(['running', 'completed', 'failed', 'cancelled', 'timed_out']);
  });
});
