import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsService } from '../metrics.service';
import { MetricsInterceptor } from '../metrics.interceptor';
import { MetricsController } from '../metrics.controller';
import { of, throwError, lastValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('should serialize empty metrics', () => {
    expect(service.serialize()).toBe('\n');
  });

  it('should increment counter', () => {
    service.incCounter('http_requests_total', { method: 'GET', status: '200' });
    service.incCounter('http_requests_total', { method: 'GET', status: '200' });
    const output = service.serialize();
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('http_requests_total{method="GET",status="200"} 2');
  });

  it('should observe histogram', () => {
    service.observeHistogram('http_request_duration_seconds', 0.05, { method: 'GET' });
    const output = service.serialize();
    expect(output).toContain('# TYPE http_request_duration_seconds histogram');
    expect(output).toContain('http_request_duration_seconds_bucket{method="GET",le="0.05"} 1');
    expect(output).toContain('http_request_duration_seconds_bucket{method="GET",le="0.005"} 0');
    expect(output).toContain('http_request_duration_seconds_sum{method="GET"}');
    expect(output).toContain('http_request_duration_seconds_count{method="GET"} 1');
  });

  it('should set gauge', () => {
    service.setGauge('active_workflows', 5, { tenant: 't1' });
    const output = service.serialize();
    expect(output).toContain('# TYPE active_workflows gauge');
    expect(output).toContain('active_workflows{tenant="t1"} 5');
  });

  it('should handle counter without labels', () => {
    service.incCounter('requests_total');
    const output = service.serialize();
    expect(output).toContain('requests_total 1');
  });
});

describe('MetricsController', () => {
  it('should return serialized metrics', () => {
    const service = new MetricsService();
    service.incCounter('test_counter', { a: '1' });
    const controller = new MetricsController(service);
    const result = controller.getMetrics();
    expect(result).toContain('test_counter{a="1"} 1');
  });
});

describe('MetricsInterceptor', () => {
  let service: MetricsService;
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    service = new MetricsService();
    interceptor = new MetricsInterceptor(service);
  });

  function createContext(method = 'GET', url = '/test', statusCode = 200): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method, url }),
        getResponse: () => ({ statusCode }),
      }),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    } as unknown as ExecutionContext;
  }

  it('should record metrics on success', async () => {
    const context = createContext('GET', '/api/health', 200);
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const result$ = interceptor.intercept(context, handler);
    await lastValueFrom(result$);
    const output = service.serialize();
    expect(output).toContain('http_requests_total{method="GET",route="/api/health",status="200"}');
    expect(output).toContain('http_request_duration_seconds');
  });

  it('should record metrics on error', async () => {
    const context = createContext('POST', '/api/fail', 500);
    const handler: CallHandler = { handle: () => throwError(() => new Error('fail')) };
    const result$ = interceptor.intercept(context, handler);
    try {
      await lastValueFrom(result$);
    } catch {
      // expected
    }
    const output = service.serialize();
    expect(output).toContain('http_requests_total{method="POST",route="/api/fail",status="500"}');
  });
});
