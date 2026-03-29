const now = new Date();
const h = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
const d = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

export const DEMO_WORKFLOWS = [
  { id: 'wf-001', taskTitle: 'Implement OAuth2 login flow', status: 'completed', repoUrl: 'https://github.com/opwerf/platform', branchName: 'opwerf/oauth2-login', totalCostUsd: 2.34, aiCostUsd: 1.89, sandboxCostUsd: 0.45, startedAt: h(6), completedAt: h(4), agentProvider: 'anthropic', agentModel: 'claude-sonnet-4-20250514', temporalWorkflowId: 'wf-run-001', pullRequestUrl: 'https://github.com/opwerf/platform/pull/142' },
  { id: 'wf-002', taskTitle: 'Fix database connection pool exhaustion', status: 'running', repoUrl: 'https://github.com/opwerf/platform', branchName: 'opwerf/fix-db-pool', totalCostUsd: 0.87, aiCostUsd: 0.72, sandboxCostUsd: 0.15, startedAt: h(1), agentProvider: 'openai', agentModel: 'gpt-4o', temporalWorkflowId: 'wf-run-002' },
  { id: 'wf-003', taskTitle: 'Add rate limiting middleware', status: 'awaiting_gate', repoUrl: 'https://github.com/opwerf/api-gateway', branchName: 'opwerf/rate-limit', totalCostUsd: 1.56, aiCostUsd: 1.23, sandboxCostUsd: 0.33, startedAt: h(3), agentProvider: 'anthropic', agentModel: 'claude-sonnet-4-20250514', temporalWorkflowId: 'wf-run-003', pullRequestUrl: 'https://github.com/opwerf/api-gateway/pull/87', gateStatus: 'pending' },
  { id: 'wf-004', taskTitle: 'Migrate user table to UUID primary keys', status: 'failed', repoUrl: 'https://github.com/opwerf/platform', branchName: 'opwerf/uuid-migration', totalCostUsd: 3.12, aiCostUsd: 2.67, sandboxCostUsd: 0.45, startedAt: h(12), completedAt: h(10), agentProvider: 'anthropic', agentModel: 'claude-sonnet-4-20250514', temporalWorkflowId: 'wf-run-004', failureReason: 'Migration rollback failed: foreign key constraint violation on sessions table' },
  { id: 'wf-005', taskTitle: 'Add Stripe webhook handler', status: 'completed', repoUrl: 'https://github.com/opwerf/billing', branchName: 'opwerf/stripe-webhooks', totalCostUsd: 1.89, aiCostUsd: 1.54, sandboxCostUsd: 0.35, startedAt: d(1), completedAt: h(20), agentProvider: 'openai', agentModel: 'gpt-4o', temporalWorkflowId: 'wf-run-005', pullRequestUrl: 'https://github.com/opwerf/billing/pull/23' },
  { id: 'wf-006', taskTitle: 'Implement WebSocket real-time notifications', status: 'completed', repoUrl: 'https://github.com/opwerf/platform', branchName: 'opwerf/ws-notifications', totalCostUsd: 4.21, aiCostUsd: 3.56, sandboxCostUsd: 0.65, startedAt: d(2), completedAt: d(2) + 'T08:00:00Z', agentProvider: 'anthropic', agentModel: 'claude-sonnet-4-20250514', temporalWorkflowId: 'wf-run-006', pullRequestUrl: 'https://github.com/opwerf/platform/pull/138' },
  { id: 'wf-007', taskTitle: 'Refactor error handling to use Result type', status: 'completed', repoUrl: 'https://github.com/opwerf/platform', branchName: 'opwerf/result-type', totalCostUsd: 1.45, aiCostUsd: 1.12, sandboxCostUsd: 0.33, startedAt: d(3), completedAt: d(3), agentProvider: 'anthropic', agentModel: 'claude-sonnet-4-20250514', temporalWorkflowId: 'wf-run-007' },
];

export const DEMO_SESSIONS = [
  { id: 'sess-001', agentSummary: 'Implemented OAuth2 authorization code flow with PKCE', stepId: 'implement', loopIteration: 1, inputTokens: 45200, outputTokens: 12300, aiCostUsd: 0.89, sandboxCostUsd: 0.22, totalCostUsd: 1.11, toolCallCount: 18, sandboxDurationSeconds: 245, turnCount: 12, qualityScore: 0.92, status: 'completed', errorCode: null, startedAt: h(6), completedAt: h(5) },
  { id: 'sess-002', agentSummary: 'Added token refresh and session management', stepId: 'implement', loopIteration: 2, inputTokens: 32100, outputTokens: 8900, aiCostUsd: 0.65, sandboxCostUsd: 0.15, totalCostUsd: 0.80, toolCallCount: 14, sandboxDurationSeconds: 180, turnCount: 8, qualityScore: 0.88, status: 'completed', errorCode: null, startedAt: h(5), completedAt: h(4.5) },
  { id: 'sess-003', agentSummary: 'Fixed CORS and redirect URI validation', stepId: 'review-fixes', loopIteration: 1, inputTokens: 18500, outputTokens: 5600, aiCostUsd: 0.35, sandboxCostUsd: 0.08, totalCostUsd: 0.43, toolCallCount: 7, sandboxDurationSeconds: 95, turnCount: 5, qualityScore: 0.95, status: 'completed', errorCode: null, startedAt: h(4.5), completedAt: h(4) },
];

export const DEMO_COSTS = {
  totalCostUsd: 15.44,
  limitUsd: 500,
  aiCostUsd: 12.73,
  sandboxCostUsd: 2.71,
  workflowCount: 7,
};

export const DEMO_API_KEYS = [
  { id: 'key-001', name: 'CI Pipeline', keyPrefix: 'opw_live_a3x9', role: 'admin', lastUsedAt: h(2), expiresAt: null, createdAt: d(30) },
  { id: 'key-002', name: 'Staging Environment', keyPrefix: 'opw_test_k7m2', role: 'editor', lastUsedAt: d(1), expiresAt: null, createdAt: d(14) },
  { id: 'key-003', name: 'Monitoring Agent', keyPrefix: 'opw_live_p5n8', role: 'viewer', lastUsedAt: h(1), expiresAt: null, createdAt: d(7) },
];

export const DEMO_WEBHOOK_DELIVERIES = [
  { id: 'del-001', provider: 'github', eventType: 'issues.labeled', status: 'processed', httpStatus: 200, retryCount: 0, createdAt: h(1), processedAt: h(1), repoUrl: 'https://github.com/opwerf/platform', taskTitle: 'Fix database connection pool exhaustion' },
  { id: 'del-002', provider: 'github', eventType: 'pull_request.review_submitted', status: 'processed', httpStatus: 200, retryCount: 0, createdAt: h(4), processedAt: h(4), repoUrl: 'https://github.com/opwerf/platform', taskTitle: 'Implement OAuth2 login flow' },
  { id: 'del-003', provider: 'gitlab', eventType: 'merge_request.approved', status: 'processed', httpStatus: 200, retryCount: 0, createdAt: h(8), processedAt: h(8), repoUrl: 'https://gitlab.com/opwerf/infra', taskTitle: 'Update Terraform modules' },
  { id: 'del-004', provider: 'github', eventType: 'issues.labeled', status: 'failed', httpStatus: 500, retryCount: 2, createdAt: d(1), processedAt: d(1), repoUrl: 'https://github.com/opwerf/api-gateway', taskTitle: 'Add rate limiting middleware' },
  { id: 'del-005', provider: 'github', eventType: 'check_suite.completed', status: 'processed', httpStatus: 200, retryCount: 0, createdAt: d(1), processedAt: d(1), repoUrl: 'https://github.com/opwerf/billing', taskTitle: 'Add Stripe webhook handler' },
];

export const DEMO_USERS = [
  { id: 'usr-001', externalId: 'usr_gh_alice', provider: 'github', email: 'alice@opwerf.dev', role: 'admin', repoAccess: ['*'], createdAt: d(90) },
  { id: 'usr-002', externalId: 'usr_gh_bob', provider: 'github', email: 'bob@opwerf.dev', role: 'operator', repoAccess: ['opwerf/platform', 'opwerf/api-gateway'], createdAt: d(60) },
  { id: 'usr-003', externalId: 'usr_gl_carol', provider: 'gitlab', email: 'carol@opwerf.dev', role: 'viewer', repoAccess: ['opwerf/platform'], createdAt: d(14) },
];

export const DEMO_SETTINGS = [
  { key: 'max_concurrent_workflows', value: '10', description: 'Maximum number of workflows running simultaneously', valueType: 'number', updatedAt: d(7) },
  { key: 'default_agent_provider', value: 'anthropic', description: 'Default AI provider for new workflows', valueType: 'string', updatedAt: d(3) },
  { key: 'sandbox_timeout_minutes', value: '60', description: 'Default sandbox timeout in minutes', valueType: 'number', updatedAt: d(14) },
  { key: 'cost_alert_threshold_percent', value: '80', description: 'Alert when cost exceeds this % of budget', valueType: 'number', updatedAt: d(7) },
];

export const DEMO_TENANTS = [
  { id: '00000000-0000-0000-0000-000000000001', slug: 'opwerf-demo', name: 'Opwerf Demo', status: 'active', maxConcurrentWorkflows: 10, maxConcurrentSandboxes: 5, monthlyCostLimitUsd: 500, defaultAgentProvider: 'anthropic', defaultAgentModel: 'claude-sonnet-4-20250514', mcpServerPolicy: 'allowlist' },
];

export const DEMO_DSL_LIST = [
  { id: 'dsl-001', name: 'standard-pipeline', version: 3, definition: { raw: 'name: standard-pipeline\nversion: 3\nsteps:\n  - id: implement\n    type: auto' }, isActive: true, createdAt: d(7) },
  { id: 'dsl-002', name: 'quick-fix', version: 1, definition: { raw: 'name: quick-fix\nversion: 1\nsteps:\n  - id: fix\n    type: auto' }, isActive: false, createdAt: d(3) },
];

export const DEMO_ARTIFACTS = [
  { id: 'art-001', kind: 'pull_request', title: 'PR #142: OAuth2 login flow', uri: 'https://github.com/opwerf/platform/pull/142', mimeType: 'text/html', status: 'ready', createdAt: h(4) },
  { id: 'art-002', kind: 'code', title: 'auth.service.ts', uri: '/artifacts/auth-service.ts', mimeType: 'text/typescript', status: 'ready', createdAt: h(5) },
  { id: 'art-003', kind: 'document', title: 'Implementation Summary', uri: '/artifacts/summary.md', mimeType: 'text/markdown', content: '# OAuth2 Implementation\n\nAdded PKCE flow with refresh tokens...', status: 'ready', createdAt: h(4) },
];

const DEMO_ROUTES: Record<string, (path: string) => unknown> = {
  '/workflows': (path) => {
    const params = new URLSearchParams(path.split('?')[1] || '');
    const status = params.get('status');
    const filtered = status ? DEMO_WORKFLOWS.filter(w => w.status === status) : DEMO_WORKFLOWS;
    return { data: filtered, total: filtered.length };
  },
  '/costs/tenants/': () => DEMO_COSTS,
  '/tenants/': (path) => {
    if (path.includes('/api-keys')) return DEMO_API_KEYS;
    if (path.includes('/users')) return DEMO_USERS;
    if (path.includes('/dsl/validate')) return { valid: true, errors: [] };
    if (path.includes('/dsl')) return DEMO_DSL_LIST;
    return DEMO_TENANTS;
  },
  '/webhook-deliveries': () => ({ data: DEMO_WEBHOOK_DELIVERIES, total: DEMO_WEBHOOK_DELIVERIES.length }),
  '/settings': () => DEMO_SETTINGS,
  '/tenants': () => DEMO_TENANTS,
};

export function getDemoData(path: string): unknown | null {
  const cleanPath = path.split('?')[0] ?? '';

  if (/\/workflows\/[^/]+\/sessions/.test(cleanPath)) return DEMO_SESSIONS;
  if (/\/workflows\/[^/]+\/artifacts/.test(cleanPath)) return DEMO_ARTIFACTS;
  if (/\/workflows\/[^/]+/.test(cleanPath) && !cleanPath.endsWith('/workflows')) {
    const id = cleanPath.split('/workflows/')[1]?.split('/')[0] ?? '';
    return DEMO_WORKFLOWS.find(w => w.id === id) ?? DEMO_WORKFLOWS[0];
  }

  for (const [route, handler] of Object.entries(DEMO_ROUTES)) {
    if (cleanPath.startsWith(route) || cleanPath.includes(route)) {
      return handler(path);
    }
  }

  return null;
}
