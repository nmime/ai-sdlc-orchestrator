import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from '../health.controller';

vi.mock('minio', () => ({
  Client: class {
    listBuckets = vi.fn().mockResolvedValue([]);
  },
}));

const mockDb = { pingCheck: vi.fn().mockResolvedValue({ database: { status: 'up' } }) };
const mockTemporal = { getClient: vi.fn().mockResolvedValue({}) };
const mockHealth = {
  check: vi.fn(async (indicators: Array<() => Promise<any>>) => {
    const results: Record<string, any> = {};
    for (const ind of indicators) {
      const r = await ind();
      Object.assign(results, r);
    }
    return { status: 'ok', details: results };
  }),
};
const mockConfig = {
  get: (key: string) => {
    const map: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost', MINIO_PORT: '9000', MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin',
    };
    return map[key];
  },
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HealthController(mockHealth as any, mockDb as any, mockTemporal as any, mockConfig as any);
  });

  describe('liveness', () => {
    it('checks database', async () => {
      const result = await controller.liveness();
      expect(result.status).toBe('ok');
    });
  });

  describe('readiness', () => {
    it('checks database and temporal', async () => {
      const result = await controller.readiness();
      expect(result.status).toBe('ok');
    });

    it('reports temporal down when getClient fails', async () => {
      mockTemporal.getClient.mockRejectedValueOnce(new Error('connect failed'));
      const result = await controller.readiness();
      expect(result.details.temporal.status).toBe('down');
    });
  });

  describe('business', () => {
    it('returns all checks up', async () => {
      const result = await controller.business();
      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.temporal.status).toBe('up');
      expect(result.checks.minio.status).toBe('up');
    });

    it('returns degraded when temporal is down', async () => {
      mockTemporal.getClient.mockRejectedValueOnce(new Error('down'));
      const result = await controller.business();
      expect(result.status).toBe('degraded');
      expect(result.checks.temporal.status).toBe('down');
    });
  });
});
