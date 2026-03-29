import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

describe('Orchestrator API (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /health/live should return 200', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual(expect.objectContaining({ status: 'ok' }));
    });

    it('GET /health/ready should return 200', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Tenants', () => {
    let tenantId: string;

    it('POST /api/v1/tenants should create a tenant', async () => {
      const result = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        payload: { slug: 'e2e-test', name: 'E2E Test Tenant' },
      });
      expect(result.statusCode).toBe(201);
      tenantId = result.json().id;
      expect(tenantId).toBeDefined();
    });

    it('GET /api/v1/tenants should list tenants', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/v1/tenants' });
      expect(result.statusCode).toBe(200);
      expect(Array.isArray(result.json())).toBe(true);
    });

    it('GET /api/v1/tenants/:id should return a tenant', async () => {
      const result = await app.inject({ method: 'GET', url: `/api/v1/tenants/${tenantId}` });
      expect(result.statusCode).toBe(200);
      expect(result.json().slug).toBe('e2e-test');
    });

    it('PATCH /api/v1/tenants/:id should update a tenant', async () => {
      const result = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tenants/${tenantId}`,
        payload: { name: 'Updated E2E Tenant' },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json().name).toBe('Updated E2E Tenant');
    });

    it('DELETE /api/v1/tenants/:id should delete a tenant', async () => {
      const result = await app.inject({ method: 'DELETE', url: `/api/v1/tenants/${tenantId}` });
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Workflows', () => {
    it('GET /api/v1/workflows should return list', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/v1/workflows' });
      expect([200, 401]).toContain(result.statusCode);
    });
  });

  describe('Metrics', () => {
    it('GET /api/v1/metrics should return prometheus format', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/v1/metrics' });
      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toContain('text/plain');
    });
  });

  describe('OpenAPI', () => {
    it('GET /api/docs-json should return OpenAPI spec', async () => {
      const result = await app.inject({ method: 'GET', url: '/api/docs-json' });
      expect(result.statusCode).toBe(200);
      const spec = result.json();
      expect(spec.openapi).toMatch(/^3\./);
      expect(spec.info.title).toBe('Opwerf API');
    });
  });
});
