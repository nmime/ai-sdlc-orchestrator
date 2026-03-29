import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { MetricsService } from './metrics.service';
import { AuthGuard } from '@app/feature-tenant';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  getMetrics(): string {
    return this.metrics.serialize();
  }
}
