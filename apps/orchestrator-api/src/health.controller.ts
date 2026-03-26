import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, MikroOrmHealthIndicator } from '@nestjs/terminus';
import { TemporalClientService } from '@ai-sdlc/common';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly temporalClient: TemporalClientService,
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

    const allUp = Object.values(checks).every(c => c.status === 'up');
    return { status: allUp ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  }
}
