import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import type { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method ?? 'UNKNOWN';
    const route = req.route?.path ?? 'unknown';
    const start = performance.now();

    return next.handle().pipe(
      tap({
        finalize: () => {
          const duration = (performance.now() - start) / 1000;
          const res = context.switchToHttp().getResponse();
          const status = String(res.statusCode ?? 200);
          this.metrics.incCounter('http_requests_total', { method, route, status });
          this.metrics.observeHistogram('http_request_duration_seconds', duration, { method, route });
        },
      }),
    );
  }
}
