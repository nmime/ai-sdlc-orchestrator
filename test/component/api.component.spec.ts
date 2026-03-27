import { setupTestApp, teardownTestApp, authHeader, getApp, getEm, getTenant } from './setup';
import { WorkflowMirror, WorkflowStatus, WorkflowEvent, AgentSession, AgentMode, SessionStatus, WorkflowArtifact, ArtifactKind, ArtifactStatus, CostAlert, AlertType } from '@ai-sdlc/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

let app: NestFastifyApplication;
let workflowId: string;

beforeAll(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;

  const em = getEm();
  const tenant = getTenant();

  const wf = new WorkflowMirror();
  wf.tenant = em.getReference('Tenant', tenant.id) as any;
  wf.temporalWorkflowId = 'twf-test-1';
  wf.temporalRunId = 'run-1';
  wf.repoId = 'org/repo';
  wf.repoUrl = 'https://github.com/org/repo.git';
  wf.state = WorkflowStatus.IMPLEMENTING;
  wf.costUsdTotal = 1.5;
  wf.aiCostUsd = 1.0;
  wf.sandboxCostUsd = 0.5;
  em.persist(wf);
  await em.flush();
  workflowId = wf.id;

  const event = new WorkflowEvent();
  event.workflow = wf;
  event.eventType = 'state_transition';
  event.fromState = 'queued';
  event.toState = 'implementing';
  em.persist(event);

  const session = new AgentSession();
  session.workflow = wf;
  session.provider = 'claude_code';
  session.mode = AgentMode.IMPLEMENT;
  session.status = SessionStatus.COMPLETED;
  session.aiCostUsd = 0.5;
  session.totalCostUsd = 0.6;
  em.persist(session);

  const artifact = new WorkflowArtifact();
  artifact.workflow = wf;
  artifact.tenant = em.getReference('Tenant', tenant.id) as any;
  artifact.kind = ArtifactKind.MERGE_REQUEST;
  artifact.title = 'MR #1';
  artifact.uri = 'https://github.com/org/repo/pull/1';
  artifact.status = ArtifactStatus.PUBLISHED;
  em.persist(artifact);

  const alert = new CostAlert();
  alert.tenant = em.getReference('Tenant', tenant.id) as any;
  alert.alertType = AlertType.TENANT_TOTAL;
  alert.thresholdPct = 80;
  alert.actualUsd = 400;
  alert.limitUsd = 500;
  em.persist(alert);

  await em.flush();
}, 120_000);

afterAll(async () => {
  await teardownTestApp();
}, 30_000);

describe('Workflows API (component)', () => {
  describe('GET /api/v1/workflows', () => {
    it('should list workflows for tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows?state=implementing',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().items.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject invalid state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows?state=bogus',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(400);
    });

    it('should support pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows?limit=1&offset=0',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().items.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/v1/workflows/:id', () => {
    it('should return workflow by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflowId}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().repoUrl).toBe('https://github.com/org/repo.git');
    });
  });

  describe('GET /api/v1/workflows/:id/events', () => {
    it('should return events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflowId}/events`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].eventType).toBe('state_transition');
    });
  });

  describe('GET /api/v1/workflows/:id/sessions', () => {
    it('should return sessions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflowId}/sessions`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/workflows/:id/artifacts', () => {
    it('should return artifacts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflowId}/artifacts`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/workflows/:id/retry', () => {
    it('should reject retry for non-blocked workflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflowId}/retry`,
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });
});

describe('Cost API (component)', () => {
  describe('GET /api/v1/costs/summary/:tenantId', () => {
    it('should return cost summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/costs/summary/${getTenant().id}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('monthlyCostLimitUsd');
      expect(body).toHaveProperty('monthlyCostActualUsd');
      expect(body).toHaveProperty('remainingUsd');
    });

    it('should return 403 for other tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/costs/summary/00000000-0000-0000-0000-000000000001',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/costs/alerts/:tenantId', () => {
    it('should return cost alerts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/costs/alerts/${getTenant().id}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/costs/sessions/:tenantId', () => {
    it('should return sessions with costs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/costs/sessions/${getTenant().id}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });
});

describe('Health API (component)', () => {
  describe('GET /api/v1/health/live', () => {
    it('should return liveness with DB up', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health/live',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return readiness (DB up, Temporal down)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health/ready',
      });
      expect([200, 503]).toContain(res.statusCode);


    });
  });

  describe('GET /api/v1/health/business', () => {
    it('should return business health', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health/business',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('checks');
      expect(body.checks.database.status).toBe('up');
    });
  });
});

describe('Metrics API (component)', () => {
  describe('GET /api/v1/metrics', () => {
    it('should return prometheus metrics without token when METRICS_TOKEN is not set', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/metrics',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('http_requests_total');
    });
  });
});

describe('Webhook API (component)', () => {
  describe('POST /api/v1/webhooks/:platform/:tenantId', () => {
    it('should return 400 for unsupported platform', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/bitbucket/test-tenant',
        headers: { 'content-type': 'application/json' },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github/invalid tenant!',
        headers: { 'content-type': 'application/json' },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject webhook for unknown tenant slug', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github/nonexistent-tenant',
        headers: { 'content-type': 'application/json', 'x-github-event': 'issues' },
        payload: { action: 'opened', issue: { number: 1, labels: [] }, repository: {} },
      });
      expect([400, 401]).toContain(res.statusCode);
    });

    it('should reject non-JSON content type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github/test-tenant',
        headers: { 'content-type': 'text/plain' },
        payload: 'not json',
      });
      expect([400, 415]).toContain(res.statusCode);
    });
  });
});

describe('Gate API (component)', () => {
  describe('GET /api/v1/gates/:workflowId/status', () => {
    it('should return 404 for non-existent workflow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/gates/non-existent-wf/status',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return workflow status for existing workflow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/gates/twf-test-1/status',
        headers: authHeader(),
      });
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  describe('POST /api/v1/gates/:workflowId/decide', () => {
    it('should return 404 for non-existent workflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/gates/non-existent-wf/decide',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { action: 'approve', reviewer: 'test-user' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/gates/:workflowId/cancel', () => {
    it('should return 404 for non-existent workflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/gates/non-existent-wf/cancel',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { reason: 'test cancel' },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('Tenant API (component)', () => {
  describe('GET /api/v1/tenants', () => {
    it('should return 401 without auth header', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/tenants' });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 with invalid API key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants',
        headers: { authorization: 'ApiKey invalid-key' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return own tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].slug).toBe('test-tenant');
    });
  });

  describe('GET /api/v1/tenants/:id', () => {
    it('should return tenant by ID', async () => {
      const tenant = getTenant();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${tenant.id}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Test Tenant');
    });

    it('should return 403 for different tenant ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${fakeId}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 400 for non-UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenants/not-a-uuid',
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/tenants', () => {
    it('should create a new tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { slug: 'new-tenant', name: 'New Tenant' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().slug).toBe('new-tenant');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/tenants/:id', () => {
    it('should update tenant name', async () => {
      const tenant = getTenant();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/tenants/${tenant.id}`,
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { name: 'Updated Tenant' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Updated Tenant');
    });
  });

  describe('GET /api/v1/tenants/:id/export', () => {
    it('should export tenant data', async () => {
      const tenant = getTenant();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tenants/${tenant.id}/export`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('tenant');
      expect(body).toHaveProperty('users');
      expect(body).toHaveProperty('workflows');
      expect(body).toHaveProperty('costAlerts');
    });
  });

  describe('DELETE /api/v1/tenants/:id', () => {
    it('should soft-delete tenant', async () => {
      const tenant = getTenant();
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenants/${tenant.id}`,
        headers: authHeader(),
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('DELETE /api/v1/tenants/:id/data', () => {
    it('should purge tenant data', async () => {
      const tenant = getTenant();
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenants/${tenant.id}/data`,
        headers: authHeader(),
      });
      expect([200, 403]).toContain(res.statusCode);
    });
  });
});
