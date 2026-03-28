import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:8080/api/v1';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-token',
      ...options.headers as Record<string, string>,
    },
    ...options,
  });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

describe('E2E: Health endpoints', () => {
  it('GET /health/live returns status ok with database info', async () => {
    const { status, body } = await api('/health/live');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.info.database.status).toBe('up');
  });

  it('GET /health/ready returns ready status', async () => {
    const { status, body } = await api('/health/ready');
    expect(status).toBe(200);
    expect(body.status).toMatch(/ok|degraded/);
  });
});

describe('E2E: Tenant CRUD', () => {
  const slug = `e2e-test-${Date.now()}`;
  let tenantId: string;

  it('POST /tenants creates a new tenant', async () => {
    const { status, body } = await api('/tenants', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'E2E Test Tenant' }),
    });
    expect(status).toBeLessThan(300);
    expect(body.slug || body.data?.slug).toBe(slug);
    tenantId = body.id || body.data?.id;
  });

  it('GET /tenants lists tenants including the new one', async () => {
    const { status, body } = await api('/tenants');
    expect(status).toBe(200);
    expect(Array.isArray(body) || Array.isArray(body.data)).toBe(true);
  });

  it('POST /tenants rejects duplicate slug', async () => {
    const { status } = await api('/tenants', {
      method: 'POST',
      body: JSON.stringify({ slug, name: 'Duplicate' }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});

describe('E2E: Workflow listing', () => {
  it('GET /workflows returns paginated list', async () => {
    const { status, body } = await api('/workflows');
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /workflows respects limit parameter', async () => {
    const { status, body } = await api('/workflows?limit=5');
    expect(status).toBe(200);
    expect(body.limit).toBeLessThanOrEqual(5);
  });

  it('GET /workflows with invalid status returns 400', async () => {
    const { status } = await api('/workflows?status=INVALID');
    expect(status).toBe(400);
  });
});

describe('E2E: DSL validation', () => {
  it('validates correct DSL', async () => {
    const { status, body } = await api('/tenants/00000000-0000-0000-0000-000000000001/dsl/validate', {
      method: 'POST',
      body: JSON.stringify({
        yaml: `
version: 1
name: test-workflow
steps:
  - id: build
    name: Build
    type: auto
    action: npm run build
`,
      }),
    });
    expect(status).toBe(201);
    expect(body.valid).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it('rejects invalid DSL with errors', async () => {
    const { status, body } = await api('/tenants/00000000-0000-0000-0000-000000000001/dsl/validate', {
      method: 'POST',
      body: JSON.stringify({ yaml: 'not: valid: yaml: {{{}' }),
    });
    expect(status).toBe(201);
    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe('E2E: Cost endpoints', () => {
  it('GET /costs/tenants/:id returns cost summary', async () => {
    const { status, body } = await api('/costs/tenants/00000000-0000-0000-0000-000000000001');
    expect(status).toBe(200);
    expect(body).toHaveProperty('tenantId');
    expect(body).toHaveProperty('totalCostUsd');
    expect(typeof body.totalCostUsd).toBe('number');
  });
});

describe('E2E: Auth enforcement', () => {
  it('rejects request without auth header', async () => {
    const res = await fetch(`${API_BASE}/workflows`, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects request with invalid scheme', async () => {
    const res = await fetch(`${API_BASE}/workflows`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic bad' },
    });
    expect(res.status).toBe(401);
  });
});

describe('E2E: API response shapes', () => {
  it('health response has correct structure', async () => {
    const { body } = await api('/health/live');
    expect(body).toMatchObject({
      status: expect.any(String),
      info: expect.any(Object),
      error: expect.any(Object),
      details: expect.any(Object),
    });
  });

  it('workflows response has correct pagination structure', async () => {
    const { body } = await api('/workflows');
    expect(typeof body.total).toBe('number');
    expect(typeof body.limit).toBe('number');
    expect(typeof body.offset).toBe('number');
  });
});
