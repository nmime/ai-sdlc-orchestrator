import { UnauthorizedException } from '@nestjs/common';
import { MetricsController } from '../metrics.controller';

describe('MetricsController', () => {
  it('should return metrics when no token configured', async () => {
    const config = { get: vi.fn().mockReturnValue(undefined) } as any;
    const controller = new MetricsController(config);
    const reply = { header: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await controller.getMetrics('', reply);
    expect(reply.header).toHaveBeenCalledWith('Content-Type', expect.any(String));
    expect(reply.send).toHaveBeenCalled();
  });

  it('should return metrics with valid token', async () => {
    const config = { get: vi.fn().mockReturnValue('secret-token') } as any;
    const controller = new MetricsController(config);
    const reply = { header: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await controller.getMetrics('Bearer secret-token', reply);
    expect(reply.send).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException with invalid token', async () => {
    const config = { get: vi.fn().mockReturnValue('secret-token') } as any;
    const controller = new MetricsController(config);
    const reply = { header: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await expect(controller.getMetrics('Bearer wrong-token', reply)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with missing auth header', async () => {
    const config = { get: vi.fn().mockReturnValue('secret-token') } as any;
    const controller = new MetricsController(config);
    const reply = { header: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await expect(controller.getMetrics('', reply)).rejects.toThrow(UnauthorizedException);
  });
});
