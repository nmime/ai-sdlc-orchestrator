import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const workflowCounter = new Counter({
  name: 'workflows_total',
  help: 'Total workflows created',
  labelNames: ['tenant_id', 'state'] as const,
  registers: [metricsRegistry],
});

export const agentSessionCost = new Histogram({
  name: 'agent_session_cost_usd',
  help: 'Agent session costs in USD',
  labelNames: ['provider', 'mode'] as const,
  buckets: [0.01, 0.1, 0.5, 1, 5, 10, 25, 50],
  registers: [metricsRegistry],
});

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() reply: FastifyReply): Promise<void> {
    const metrics = await metricsRegistry.metrics();
    reply.header('Content-Type', metricsRegistry.contentType).send(metrics);
  }
}
