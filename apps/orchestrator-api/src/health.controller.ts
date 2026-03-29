import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, MikroOrmHealthIndicator } from '@nestjs/terminus';
import { TemporalClientService, MINIO_CLIENT } from '@app/common';
import type { Client as MinioClient } from 'minio';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly temporalClient: TemporalClientService,
    @Inject(MINIO_CLIENT) private readonly minioClient: MinioClient,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async liveness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check (DB + Temporal)' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  async readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      async () => {
        try {
          await this.temporalClient.getClient();
          return { temporal: { status: 'up' as const } };
        } catch {
          return { temporal: { status: 'down' as const } };
        }
      },
    ]);
  }

  @Get('business')
  @ApiOperation({ summary: 'Deep business health check' })
  @ApiResponse({ status: 200, description: 'Business health status with component checks' })
  async business() {
    const checks: Record<string, { status: string }> = {};

    try {
      await this.db.pingCheck('database');
      checks['database'] = { status: 'up' };
    } catch {
      checks['database'] = { status: 'down' };
    }

    try {
      await this.temporalClient.getClient();
      checks['temporal'] = { status: 'up' };
    } catch {
      checks['temporal'] = { status: 'down' };
    }

    try {
      await this.minioClient.listBuckets();
      checks['minio'] = { status: 'up' };
    } catch {
      checks['minio'] = { status: 'down' };
    }

    const allUp = Object.values(checks).every(c => c.status === 'up');
    return { status: allUp ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  }
}
