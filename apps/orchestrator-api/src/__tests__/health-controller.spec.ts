import { HealthController } from '../health.controller';

function buildController(dbUp = true, temporalUp = true) {
  const health = {
    check: vi.fn(async (indicators: (() => Promise<any>)[]) => {
      const results: Record<string, any> = {};
      for (const indicator of indicators) {
        const result = await indicator();
        Object.assign(results, result);
      }
      return { status: 'ok', details: results };
    }),
  } as any;

  const db = {
    pingCheck: vi.fn(async (name: string) => {
      if (!dbUp) throw new Error('DB down');
      return { [name]: { status: 'up' } };
    }),
  } as any;

  const temporalClient = {
    getClient: vi.fn(async () => {
      if (!temporalUp) throw new Error('Temporal down');
      return {};
    }),
  } as any;

  return { controller: new HealthController(health, db, temporalClient), health, db, temporalClient };
}

describe('HealthController', () => {
  describe('liveness', () => {
    it('should check database', async () => {
      const { controller, db } = buildController();
      const result = await controller.liveness();
      expect(db.pingCheck).toHaveBeenCalledWith('database');
      expect(result.status).toBe('ok');
    });
  });

  describe('readiness', () => {
    it('should check both database and temporal', async () => {
      const { controller } = buildController();
      const result = await controller.readiness();
      expect(result.status).toBe('ok');
    });

    it('should report temporal down', async () => {
      const { controller } = buildController(true, false);
      const result = await controller.readiness();
      expect(result.details.temporal.status).toBe('down');
    });
  });

  describe('business', () => {
    it('should return ok when all services up', async () => {
      const { controller } = buildController();
      const result = await controller.business();
      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.temporal.status).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded when temporal is down', async () => {
      const { controller } = buildController(true, false);
      const result = await controller.business();
      expect(result.status).toBe('degraded');
      expect(result.checks.temporal.status).toBe('down');
    });

    it('should return degraded when database is down', async () => {
      const { controller } = buildController(false, true);
      const result = await controller.business();
      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('down');
    });
  });
});
