import { Tenant, TenantStatus, McpServerPolicy } from '../entities/tenant.entity';
import { TenantUser, TenantRole } from '../entities/tenant-user.entity';
import { TenantApiKey, ApiKeyRole } from '../entities/tenant-api-key.entity';
import { TenantRepoConfig, AgentProvider, CloneStrategy } from '../entities/tenant-repo-config.entity';
import { TenantMcpServer, McpTransport } from '../entities/tenant-mcp-server.entity';
import { TenantVcsCredential, VcsProvider } from '../entities/tenant-vcs-credential.entity';
import { TenantWebhookConfig, WebhookPlatform, WebhookConfigStatus } from '../entities/tenant-webhook-config.entity';
import { WorkflowMirror, WorkflowStatus } from '../entities/workflow-mirror.entity';
import { WorkflowArtifact, ArtifactKind, ArtifactStatus } from '../entities/workflow-artifact.entity';
import { WorkflowDsl } from '../entities/workflow-dsl.entity';
import { WorkflowEvent } from '../entities/workflow-event.entity';
import { AgentSession, SessionStatus, AgentMode, SessionErrorCode, StaticAnalysisResult } from '../entities/agent-session.entity';
import { AgentToolCall, ToolCallStatus } from '../entities/agent-tool-call.entity';
import { CostAlert, AlertType } from '../entities/cost-alert.entity';
import { PollingSchedule } from '../entities/polling-schedule.entity';
import { WebhookDelivery, DeliveryStatus } from '../entities/webhook-delivery.entity';
import { McpServerRegistry } from '../entities/mcp-server-registry.entity';

describe('Entity instantiation and defaults', () => {
  describe('Tenant', () => {
    it('should create with correct defaults', () => {
      const t = new Tenant();
      expect(t.id).toBeDefined();
      expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(t.status).toBe(TenantStatus.ACTIVE);
      expect(t.maxConcurrentWorkflows).toBe(10);
      expect(t.maxConcurrentSandboxes).toBe(5);
      expect(t.monthlyCostLimitUsd).toBe(500);
      expect(t.monthlyCostReservedUsd).toBe(0);
      expect(t.monthlyCostActualUsd).toBe(0);
      expect(t.monthlyAiCostActualUsd).toBe(0);
      expect(t.monthlySandboxCostActualUsd).toBe(0);
      expect(t.sandboxHourlyRateUsd).toBe(0.05);
      expect(t.budgetVersion).toBe(0);
      expect(t.mcpServerPolicy).toBe(McpServerPolicy.CURATED);
      expect(t.createdAt).toBeInstanceOf(Date);
      expect(t.updatedAt).toBeInstanceOf(Date);
      expect(t.users).toBeDefined();
      expect(t.apiKeys).toBeDefined();
      expect(t.repoConfigs).toBeDefined();
      expect(t.mcpServers).toBeDefined();
      expect(t.vcsCredentials).toBeDefined();
      expect(t.webhookConfigs).toBeDefined();
    });

    it('should have all enum values', () => {
      expect(TenantStatus.PENDING).toBe('pending');
      expect(TenantStatus.PROVISIONING).toBe('provisioning');
      expect(TenantStatus.ACTIVE).toBe('active');
      expect(TenantStatus.SUSPENDED).toBe('suspended');
      expect(TenantStatus.DEACTIVATING).toBe('deactivating');
      expect(TenantStatus.DEACTIVATED).toBe('deactivated');
      expect(TenantStatus.DELETED).toBe('deleted');
      expect(McpServerPolicy.CURATED).toBe('curated');
      expect(McpServerPolicy.OPEN).toBe('open');
    });

    it('should allow setting optional properties', () => {
      const t = new Tenant();
      t.slug = 'acme';
      t.name = 'Acme Corp';
      t.temporalNamespace = 'acme-ns';
      t.defaultAgentProvider = 'claude_code';
      t.defaultAgentModel = 'claude-4';
      t.agentProviderApiKeyRefs = { anthropic: 'ref-1' };
      t.monthlyAiCostLimitUsd = 200;
      t.monthlySandboxCostLimitUsd = 100;
      t.costAlertThresholds = [50, 80, 95];
      t.meta = { tier: 'enterprise' };
      expect(t.slug).toBe('acme');
      expect(t.temporalNamespace).toBe('acme-ns');
      expect(t.costAlertThresholds).toEqual([50, 80, 95]);
    });
  });

  describe('TenantUser', () => {
    it('should create with correct defaults', () => {
      const u = new TenantUser();
      expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(u.role).toBe(TenantRole.VIEWER);
      expect(u.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting properties', () => {
      const u = new TenantUser();
      u.externalId = 'ext-1';
      u.provider = 'github';
      u.email = 'user@example.com';
      u.role = TenantRole.ADMIN;
      u.repoAccess = ['repo1', 'repo2'];
      expect(u.role).toBe(TenantRole.ADMIN);
      expect(u.repoAccess).toHaveLength(2);
    });

    it('should have all enum values', () => {
      expect(TenantRole.ADMIN).toBe('admin');
      expect(TenantRole.OPERATOR).toBe('operator');
      expect(TenantRole.VIEWER).toBe('viewer');
    });
  });

  describe('TenantApiKey', () => {
    it('should create with correct defaults', () => {
      const k = new TenantApiKey();
      expect(k.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(k.role).toBe(ApiKeyRole.VIEWER);
      expect(k.createdAt).toBeInstanceOf(Date);
      expect(k.expiresAt).toBeUndefined();
    });

    it('should allow setting all properties', () => {
      const k = new TenantApiKey();
      k.keyHash = 'abc123';
      k.name = 'production-key';
      k.role = ApiKeyRole.ADMIN;
      k.expiresAt = new Date('2025-12-31');
      expect(k.role).toBe(ApiKeyRole.ADMIN);
      expect(k.expiresAt).toBeInstanceOf(Date);
    });

    it('should have all enum values', () => {
      expect(ApiKeyRole.ADMIN).toBe('admin');
      expect(ApiKeyRole.OPERATOR).toBe('operator');
      expect(ApiKeyRole.VIEWER).toBe('viewer');
    });
  });

  describe('TenantRepoConfig', () => {
    it('should create with correct defaults', () => {
      const r = new TenantRepoConfig();
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.maxConcurrentWorkflows).toBe(1);
      expect(r.costLimitUsd).toBe(5);
      expect(r.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all optional properties', () => {
      const r = new TenantRepoConfig();
      r.repoId = 'org/repo';
      r.repoUrl = 'https://github.com/org/repo';
      r.branchPrefix = 'ai/';
      r.setupCommand = 'pnpm install';
      r.testCommand = 'pnpm test';
      r.lintCommand = 'pnpm lint';
      r.typecheckCommand = 'pnpm tsc';
      r.buildCommand = 'pnpm build';
      r.agentTemplateId = 'tmpl-1';
      r.agentProvider = AgentProvider.CLAUDE_CODE;
      r.agentModel = 'claude-4';
      r.modelRouting = { implement: 'claude-4', ci_fix: 'claude-3.5' };
      r.costTiers = { small: 2, large: 10 };
      r.maxDiffLines = 500;
      r.allowedPaths = ['src/', 'tests/'];
      r.commitMessagePattern = 'feat(ai): {message}';
      r.mrDescriptionTemplate = '## AI Changes\n{summary}';
      r.qualityGateCommands = ['pnpm lint', 'pnpm test'];
      r.staticAnalysisCommand = 'pnpm lint';
      r.cloneStrategy = CloneStrategy.SPARSE;
      r.sparseCheckoutPaths = ['src/', 'package.json'];
      r.concurrencyHints = { maxParallel: 2 };
      expect(r.agentProvider).toBe(AgentProvider.CLAUDE_CODE);
      expect(r.cloneStrategy).toBe(CloneStrategy.SPARSE);
    });

    it('should have all enum values', () => {
      expect(AgentProvider.CLAUDE_CODE).toBe('claude_code');
      expect(AgentProvider.OPENHANDS).toBe('openhands');
      expect(AgentProvider.AIDER).toBe('aider');
      expect(CloneStrategy.FULL).toBe('full');
      expect(CloneStrategy.SPARSE).toBe('sparse');
      expect(CloneStrategy.SHALLOW).toBe('shallow');
    });
  });

  describe('TenantMcpServer', () => {
    it('should create with correct defaults', () => {
      const s = new TenantMcpServer();
      expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(s.isEnabled).toBe(true);
      expect(s.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const s = new TenantMcpServer();
      s.name = 'my-server';
      s.transport = McpTransport.SSE;
      s.url = 'https://mcp.example.com';
      s.command = 'npx';
      s.args = ['@modelcontextprotocol/server'];
      s.headersSecretRef = { auth: 'secret-ref' };
      s.envSecretRef = { API_KEY: 'key-ref' };
      s.isEnabled = false;
      expect(s.transport).toBe(McpTransport.SSE);
      expect(s.isEnabled).toBe(false);
    });

    it('should have all enum values', () => {
      expect(McpTransport.STDIO).toBe('stdio');
      expect(McpTransport.SSE).toBe('sse');
      expect(McpTransport.STREAMABLE_HTTP).toBe('streamable_http');
    });
  });

  describe('TenantVcsCredential', () => {
    it('should create with correct defaults', () => {
      const c = new TenantVcsCredential();
      expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting properties', () => {
      const c = new TenantVcsCredential();
      c.provider = VcsProvider.GITHUB;
      c.host = 'github.com';
      c.secretRef = 'vault:github-token';
      expect(c.provider).toBe(VcsProvider.GITHUB);
    });

    it('should have all enum values', () => {
      expect(VcsProvider.GITHUB).toBe('github');
      expect(VcsProvider.GITLAB).toBe('gitlab');
      expect(VcsProvider.BITBUCKET).toBe('bitbucket');
    });
  });

  describe('TenantWebhookConfig', () => {
    it('should create with correct defaults', () => {
      const w = new TenantWebhookConfig();
      expect(w.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(w.status).toBe(WebhookConfigStatus.ACTIVE);
      expect(w.createdAt).toBeInstanceOf(Date);
      expect(w.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const w = new TenantWebhookConfig();
      w.platform = WebhookPlatform.GITHUB;
      w.webhookId = 'wh-123';
      w.webhookUrl = 'https://hooks.example.com/gh';
      w.status = WebhookConfigStatus.INACTIVE;
      w.secretRef = 'vault:webhook-secret';
      expect(w.platform).toBe(WebhookPlatform.GITHUB);
      expect(w.status).toBe(WebhookConfigStatus.INACTIVE);
    });

    it('should have all enum values', () => {
      expect(WebhookPlatform.JIRA).toBe('jira');
      expect(WebhookPlatform.GITLAB).toBe('gitlab');
      expect(WebhookPlatform.GITHUB).toBe('github');
      expect(WebhookPlatform.LINEAR).toBe('linear');
      expect(WebhookConfigStatus.ACTIVE).toBe('active');
      expect(WebhookConfigStatus.INACTIVE).toBe('inactive');
    });
  });

  describe('WorkflowMirror', () => {
    it('should create with correct defaults', () => {
      const m = new WorkflowMirror();
      expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(m.state).toBe(WorkflowStatus.QUEUED);
      expect(m.fixAttemptCount).toBe(0);
      expect(m.reviewAttemptCount).toBe(0);
      expect(m.costUsdTotal).toBe(0);
      expect(m.costUsdReserved).toBe(0);
      expect(m.aiCostUsd).toBe(0);
      expect(m.sandboxCostUsd).toBe(0);
      expect(m.createdAt).toBeInstanceOf(Date);
      expect(m.updatedAt).toBeInstanceOf(Date);
      expect(m.sessions).toBeDefined();
      expect(m.events).toBeDefined();
      expect(m.artifacts).toBeDefined();
    });

    it('should have all status enum values', () => {
      expect(WorkflowStatus.QUEUED).toBe('queued');
      expect(WorkflowStatus.IMPLEMENTING).toBe('implementing');
      expect(WorkflowStatus.CI_WATCH).toBe('ci_watch');
      expect(WorkflowStatus.CI_PASSED).toBe('ci_passed');
      expect(WorkflowStatus.CI_FAILED).toBe('ci_failed');
      expect(WorkflowStatus.CI_FIXING).toBe('ci_fixing');
      expect(WorkflowStatus.IN_REVIEW).toBe('in_review');
      expect(WorkflowStatus.REVIEW_FIXING).toBe('review_fixing');
      expect(WorkflowStatus.COMPLETED).toBe('completed');
      expect(WorkflowStatus.BLOCKED_RECOVERABLE).toBe('blocked_recoverable');
      expect(WorkflowStatus.BLOCKED_TERMINAL).toBe('blocked_terminal');
      expect(WorkflowStatus.CANCELLED).toBe('cancelled');
      expect(WorkflowStatus.TIMED_OUT).toBe('timed_out');
    });

    it('should allow setting optional properties', () => {
      const m = new WorkflowMirror();
      m.temporalWorkflowId = 'twf-1';
      m.temporalRunId = 'run-1';
      m.repoId = 'org/repo';
      m.repoUrl = 'https://github.com/org/repo';
      m.taskId = '#42';
      m.taskProvider = 'github';
      m.branchName = 'ai/fix-42';
      m.mrId = 'mr-1';
      m.mrUrl = 'https://github.com/org/repo/pull/1';
      m.currentStepId = 'implement';
      m.dslName = 'default';
      m.dslVersion = 2;
      m.childrenStatus = { child1: 'completed' };
      m.errorMessage = 'Something failed';
      expect(m.taskId).toBe('#42');
      expect(m.dslVersion).toBe(2);
    });
  });

  describe('WorkflowArtifact', () => {
    it('should create with correct defaults', () => {
      const a = new WorkflowArtifact();
      expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(a.status).toBe(ArtifactStatus.DRAFT);
      expect(a.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const a = new WorkflowArtifact();
      a.kind = ArtifactKind.MERGE_REQUEST;
      a.title = 'MR for issue #42';
      a.uri = 'https://github.com/org/repo/pull/1';
      a.mimeType = 'text/html';
      a.previewUrl = 'https://preview.example.com';
      a.metadata = { lines: 200 };
      a.content = '<html>report</html>';
      a.status = ArtifactStatus.PUBLISHED;
      a.stepId = 'implement';
      expect(a.kind).toBe(ArtifactKind.MERGE_REQUEST);
      expect(a.status).toBe(ArtifactStatus.PUBLISHED);
    });

    it('should have all enum values', () => {
      expect(ArtifactKind.MERGE_REQUEST).toBe('merge_request');
      expect(ArtifactKind.DESIGN).toBe('design');
      expect(ArtifactKind.DOCUMENT).toBe('document');
      expect(ArtifactKind.REPORT).toBe('report');
      expect(ArtifactKind.IMAGE).toBe('image');
      expect(ArtifactKind.TEST_REPORT).toBe('test_report');
      expect(ArtifactKind.BUILD_OUTPUT).toBe('build_output');
      expect(ArtifactKind.OTHER).toBe('other');
      expect(ArtifactStatus.DRAFT).toBe('draft');
      expect(ArtifactStatus.PUBLISHED).toBe('published');
    });
  });

  describe('WorkflowDsl', () => {
    it('should create with correct defaults', () => {
      const d = new WorkflowDsl();
      expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(d.isActive).toBe(true);
      expect(d.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting properties', () => {
      const d = new WorkflowDsl();
      d.name = 'default-workflow';
      d.version = 3;
      d.definition = { steps: [] };
      d.isActive = false;
      expect(d.name).toBe('default-workflow');
      expect(d.isActive).toBe(false);
    });
  });

  describe('WorkflowEvent', () => {
    it('should create with correct defaults', () => {
      const e = new WorkflowEvent();
      expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(e.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const e = new WorkflowEvent();
      e.eventType = 'state_transition';
      e.fromState = 'implementing';
      e.toState = 'ci_watch';
      e.payload = { details: 'passed' };
      e.aiCostUsd = 0.5;
      e.sandboxCostUsd = 0.1;
      e.totalCostUsd = 0.6;
      expect(e.eventType).toBe('state_transition');
      expect(e.totalCostUsd).toBe(0.6);
    });
  });

  describe('AgentSession', () => {
    it('should create with correct defaults', () => {
      const s = new AgentSession();
      expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(s.status).toBe(SessionStatus.RUNNING);
      expect(s.loopIteration).toBe(0);
      expect(s.inputTokens).toBe(0);
      expect(s.outputTokens).toBe(0);
      expect(s.aiCostUsd).toBe(0);
      expect(s.sandboxCostUsd).toBe(0);
      expect(s.totalCostUsd).toBe(0);
      expect(s.turnCount).toBe(0);
      expect(s.toolCallCount).toBe(0);
      expect(s.startedAt).toBeInstanceOf(Date);
      expect(s.toolCalls).toBeDefined();
    });

    it('should allow setting all optional properties', () => {
      const s = new AgentSession();
      s.provider = 'claude_code';
      s.mode = AgentMode.IMPLEMENT;
      s.stepId = 'step-1';
      s.promptSent = 'Fix the bug';
      s.agentSummary = 'Fixed 3 files';
      s.result = { success: true };
      s.status = SessionStatus.COMPLETED;
      s.errorCode = SessionErrorCode.AGENT_TIMEOUT;
      s.sandboxDurationSeconds = 120;
      s.sandboxId = 'sb-1';
      s.sandboxCreatedAt = new Date();
      s.sandboxDestroyedAt = new Date();
      s.model = 'claude-4';
      s.qualityScore = 85.5;
      s.qualityGatesPassed = { lint: true, test: true };
      s.diffLinesChanged = 42;
      s.progressIndicator = { pct: 100 };
      s.filesModified = ['src/a.ts', 'src/b.ts'];
      s.testOutputSnippet = 'All tests passed';
      s.staticAnalysisResult = StaticAnalysisResult.PASSED;
      s.staticAnalysisOutput = 'No issues';
      s.completedAt = new Date();
      expect(s.status).toBe(SessionStatus.COMPLETED);
      expect(s.errorCode).toBe(SessionErrorCode.AGENT_TIMEOUT);
    });

    it('should have all enum values', () => {
      expect(SessionStatus.RUNNING).toBe('running');
      expect(SessionStatus.COMPLETED).toBe('completed');
      expect(SessionStatus.FAILED).toBe('failed');
      expect(SessionStatus.CANCELLED).toBe('cancelled');
      expect(SessionStatus.TIMED_OUT).toBe('timed_out');
      expect(AgentMode.IMPLEMENT).toBe('implement');
      expect(AgentMode.CI_FIX).toBe('ci_fix');
      expect(AgentMode.REVIEW_FIX).toBe('review_fix');
      expect(SessionErrorCode.SANDBOX_CREATE_FAILED).toBe('sandbox_create_failed');
      expect(SessionErrorCode.SANDBOX_TIMEOUT).toBe('sandbox_timeout');
      expect(SessionErrorCode.CLONE_FAILED).toBe('clone_failed');
      expect(SessionErrorCode.AGENT_TIMEOUT).toBe('agent_timeout');
      expect(SessionErrorCode.AGENT_CRASH).toBe('agent_crash');
      expect(SessionErrorCode.COST_LIMIT).toBe('cost_limit');
      expect(SessionErrorCode.TURN_LIMIT).toBe('turn_limit');
      expect(SessionErrorCode.CANCELLED).toBe('cancelled');
      expect(SessionErrorCode.CREDENTIAL_ERROR).toBe('credential_error');
      expect(SessionErrorCode.MCP_ERROR).toBe('mcp_error');
      expect(SessionErrorCode.SECURITY_VIOLATION).toBe('security_violation');
      expect(SessionErrorCode.NO_PROGRESS).toBe('no_progress');
      expect(SessionErrorCode.REGRESSION).toBe('regression');
      expect(SessionErrorCode.UNKNOWN).toBe('unknown');
      expect(StaticAnalysisResult.PASSED).toBe('passed');
      expect(StaticAnalysisResult.FAILED).toBe('failed');
      expect(StaticAnalysisResult.SKIPPED).toBe('skipped');
    });
  });

  describe('AgentToolCall', () => {
    it('should create with correct defaults', () => {
      const tc = new AgentToolCall();
      expect(tc.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(tc.status).toBe(ToolCallStatus.RUNNING);
      expect(tc.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const tc = new AgentToolCall();
      tc.sequenceNumber = 1;
      tc.toolName = 'write_file';
      tc.inputSummary = { path: '/src/a.ts' };
      tc.outputSummary = { success: true };
      tc.status = ToolCallStatus.COMPLETED;
      tc.durationMs = 150;
      expect(tc.toolName).toBe('write_file');
      expect(tc.status).toBe(ToolCallStatus.COMPLETED);
    });

    it('should have all enum values', () => {
      expect(ToolCallStatus.RUNNING).toBe('running');
      expect(ToolCallStatus.COMPLETED).toBe('completed');
      expect(ToolCallStatus.FAILED).toBe('failed');
    });
  });

  describe('CostAlert', () => {
    it('should create with correct defaults', () => {
      const a = new CostAlert();
      expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(a.acknowledged).toBe(false);
      expect(a.createdAt).toBeInstanceOf(Date);
      expect(a.acknowledgedAt).toBeUndefined();
    });

    it('should allow setting all properties', () => {
      const a = new CostAlert();
      a.alertType = AlertType.TENANT_TOTAL;
      a.thresholdPct = 80;
      a.actualUsd = 400;
      a.limitUsd = 500;
      a.acknowledged = true;
      a.acknowledgedAt = new Date();
      expect(a.alertType).toBe(AlertType.TENANT_TOTAL);
      expect(a.acknowledged).toBe(true);
    });

    it('should have all enum values', () => {
      expect(AlertType.TASK_COST).toBe('task_cost');
      expect(AlertType.TENANT_AI).toBe('tenant_ai');
      expect(AlertType.TENANT_SANDBOX).toBe('tenant_sandbox');
      expect(AlertType.TENANT_TOTAL).toBe('tenant_total');
      expect(AlertType.SYSTEM).toBe('system');
    });
  });

  describe('PollingSchedule', () => {
    it('should create with correct defaults', () => {
      const p = new PollingSchedule();
      expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(p.pollIntervalSeconds).toBe(900);
      expect(p.enabled).toBe(true);
      expect(p.createdAt).toBeInstanceOf(Date);
      expect(p.lastPollAt).toBeUndefined();
    });

    it('should allow setting all properties', () => {
      const p = new PollingSchedule();
      p.platform = 'jira';
      p.queryFilter = { project: 'AI' };
      p.pollIntervalSeconds = 300;
      p.lastPollAt = new Date();
      p.enabled = false;
      expect(p.pollIntervalSeconds).toBe(300);
      expect(p.enabled).toBe(false);
    });
  });

  describe('WebhookDelivery', () => {
    it('should create with correct defaults', () => {
      const d = new WebhookDelivery();
      expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(d.status).toBe(DeliveryStatus.RECEIVED);
      expect(d.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const d = new WebhookDelivery();
      d.platform = 'github';
      d.deliveryId = 'gh-del-123';
      d.eventType = 'issues';
      d.payloadHash = 'abc123';
      d.status = DeliveryStatus.PROCESSED;
      d.workflowId = 'wf-1';
      d.errorMessage = 'timeout';
      expect(d.status).toBe(DeliveryStatus.PROCESSED);
    });

    it('should have all enum values', () => {
      expect(DeliveryStatus.RECEIVED).toBe('received');
      expect(DeliveryStatus.PROCESSING).toBe('processing');
      expect(DeliveryStatus.PROCESSED).toBe('processed');
      expect(DeliveryStatus.DEDUPLICATED).toBe('deduplicated');
      expect(DeliveryStatus.IGNORED).toBe('ignored');
      expect(DeliveryStatus.INVALID).toBe('invalid');
      expect(DeliveryStatus.FAILED).toBe('failed');
    });
  });

  describe('McpServerRegistry', () => {
    it('should create with correct defaults', () => {
      const r = new McpServerRegistry();
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.isVerified).toBe(false);
      expect(r.createdAt).toBeInstanceOf(Date);
    });

    it('should allow setting all properties', () => {
      const r = new McpServerRegistry();
      r.name = 'filesystem';
      r.description = 'MCP filesystem server';
      r.protocolVersion = '2024-11-05';
      r.scopingCapability = 'full';
      r.isVerified = true;
      r.defaultConfig = { maxFileSize: 1048576 };
      expect(r.name).toBe('filesystem');
      expect(r.isVerified).toBe(true);
    });
  });

  describe('unique IDs per instance', () => {
    it('should generate unique IDs for each entity instance', () => {
      const t1 = new Tenant();
      const t2 = new Tenant();
      expect(t1.id).not.toBe(t2.id);

      const u1 = new TenantUser();
      const u2 = new TenantUser();
      expect(u1.id).not.toBe(u2.id);

      const m1 = new WorkflowMirror();
      const m2 = new WorkflowMirror();
      expect(m1.id).not.toBe(m2.id);
    });
  });
});
