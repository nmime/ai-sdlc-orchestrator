import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method ?? 'UNKNOWN';
    const route = req.route?.path ?? req.url ?? '/';
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, route, context),
        error: () => this.record(method, route, context),
        finalize: () => {
          const duration = (performance.now() - start) / 1000;
          this.metrics.observeHistogram('http_request_duration_seconds', duration, { method, route });
        },
      }),
    );
  }

  private record(method: string, route: string, context: ExecutionContext): void {
    const res = context.switchToHttp().getResponse();
    const status = String(res.statusCode ?? 200);
    this.metrics.incCounter('http_requests_total', { method, route, status });
  }
}
