import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, MikroOrmHealthIndicator } from '@nestjs/terminus';
import { TemporalClientService } from '@app/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import * as Minio from 'minio';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private minioClient: Minio.Client;

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly temporalClient: TemporalClientService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', { infer: true }) || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT', { infer: true }) || '9000', 10),
      useSSL: this.configService.get('MINIO_USE_SSL', { infer: true }) === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', { infer: true }) || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY', { infer: true }) || '',
    });
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check' })
  async liveness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check (DB + Temporal)' })
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
