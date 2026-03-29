import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { type HealthCheckService, HealthCheck, type MikroOrmHealthIndicator } from '@nestjs/terminus';
import { type TemporalClientService, MINIO_CLIENT } from '@app/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import type { Client as MinioClient } from 'minio';
import { createConnection } from 'net';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly temporalClient: TemporalClientService,
    @Inject(MINIO_CLIENT) private readonly minioClient: MinioClient,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

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
  @ApiOperation({ summary: 'Readiness check (DB + Temporal + Redis)' })
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
      async () => {
        try {
          await this.checkRedis();
          return { redis: { status: 'up' as const } };
        } catch {
          return { redis: { status: 'down' as const } };
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

    try {
      await this.checkRedis();
      checks['redis'] = { status: 'up' };
    } catch {
      checks['redis'] = { status: 'down' };
    }

    const allUp = Object.values(checks).every(c => c.status === 'up');
    return { status: allUp ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  }

  private checkRedis(): Promise<void> {
    const redisUrl = this.configService.get('REDIS_URL');
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = parseInt(url.port || '6379', 10);

    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port, timeout: 3000 }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Redis connection timeout'));
      });
    });
  }
}
