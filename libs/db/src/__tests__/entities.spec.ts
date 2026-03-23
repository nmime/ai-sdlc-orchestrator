import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { TenantUser, TenantRole } from '../entities/tenant-user.entity';
import { TenantApiKey } from '../entities/tenant-api-key.entity';
import { TenantRepoConfig, AgentProvider } from '../entities/tenant-repo-config.entity';
import { WebhookDelivery, DeliveryStatus } from '../entities/webhook-delivery.entity';
import { WorkflowMirror, WorkflowStatus } from '../entities/workflow-mirror.entity';
import { WorkflowDsl, DslStatus } from '../entities/workflow-dsl.entity';
import { AgentSession, SessionStatus } from '../entities/agent-session.entity';
import { AgentToolCall, ToolCallStatus } from '../entities/agent-tool-call.entity';
import { CostAlert, AlertType, AlertStatus } from '../entities/cost-alert.entity';
import { PollingSchedule, PollingFrequency } from '../entities/polling-schedule.entity';
import { McpServerRegistry, RegistryStatus } from '../entities/mcp-server-registry.entity';

describe('Entity defaults', () => {
  it('Tenant should have correct defaults', () => {
    const tenant = new Tenant();
    expect(tenant.id).toBeDefined();
    expect(tenant.status).toBe(TenantStatus.ACTIVE);
    expect(tenant.budgetLimitUsd).toBe(0);
    expect(tenant.budgetUsedUsd).toBe(0);
    expect(tenant.budgetVersion).toBe(0);
    expect(tenant.createdAt).toBeInstanceOf(Date);
  });

  it('TenantUser should default to VIEWER role', () => {
    const user = new TenantUser();
    expect(user.role).toBe(TenantRole.VIEWER);
  });

  it('TenantApiKey should default to active', () => {
    const key = new TenantApiKey();
    expect(key.active).toBe(true);
  });

  it('TenantRepoConfig should default to CLAUDE_CODE', () => {
    const config = new TenantRepoConfig();
    expect(config.agentProvider).toBe(AgentProvider.CLAUDE_CODE);
    expect(config.maxCostPerTaskUsd).toBe(50);
    expect(config.enabled).toBe(true);
  });

  it('WebhookDelivery should default to RECEIVED', () => {
    const delivery = new WebhookDelivery();
    expect(delivery.status).toBe(DeliveryStatus.RECEIVED);
  });

  it('WorkflowMirror should default to QUEUED', () => {
    const mirror = new WorkflowMirror();
    expect(mirror.status).toBe(WorkflowStatus.QUEUED);
    expect(mirror.totalCostUsd).toBe(0);
    expect(mirror.retryCount).toBe(0);
  });

  it('WorkflowDsl should default to DRAFT', () => {
    const dsl = new WorkflowDsl();
    expect(dsl.status).toBe(DslStatus.DRAFT);
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

  it('CostAlert should default to ACTIVE', () => {
    const alert = new CostAlert();
    expect(alert.status).toBe(AlertStatus.ACTIVE);
  });

  it('PollingSchedule should default to 15min', () => {
    const schedule = new PollingSchedule();
    expect(schedule.frequency).toBe(PollingFrequency.EVERY_15_MIN);
    expect(schedule.enabled).toBe(true);
  });

  it('McpServerRegistry should default to COMMUNITY', () => {
    const registry = new McpServerRegistry();
    expect(registry.status).toBe(RegistryStatus.COMMUNITY);
  });
});

describe('Entity enums', () => {
  it('TenantStatus should have all values', () => {
    expect(Object.values(TenantStatus)).toEqual(['active', 'suspended', 'deleted']);
  });

  it('TenantRole should have all values', () => {
    expect(Object.values(TenantRole)).toEqual(['admin', 'operator', 'viewer']);
  });

  it('WorkflowStatus should have all values', () => {
    expect(Object.values(WorkflowStatus)).toEqual([
      'queued', 'running', 'awaiting_gate', 'awaiting_ci',
      'awaiting_review', 'completed', 'failed', 'cancelled', 'timed_out',
    ]);
  });

  it('AgentProvider should have all values', () => {
    expect(Object.values(AgentProvider)).toEqual(['claude_code', 'openhands', 'aider']);
  });

  it('SessionStatus should have all values', () => {
    expect(Object.values(SessionStatus)).toEqual(['running', 'completed', 'failed', 'cancelled', 'timed_out']);
  });
});
