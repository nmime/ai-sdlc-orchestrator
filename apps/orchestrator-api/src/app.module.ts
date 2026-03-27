import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule, LoggerModule, DatabaseModule, TemporalModule } from '@ai-sdlc/common';
import { BootstrapService } from '@ai-sdlc/common';
import { TenantModule } from '@ai-sdlc/feature-tenant';
import { WebhookModule } from '@ai-sdlc/feature-webhook';
import { GateModule } from '@ai-sdlc/feature-gate';
import { HealthController } from './health.controller';
import { WorkflowsController } from './workflows.controller';
import { CostController } from './cost.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    LoggerModule,
    DatabaseModule,
    TemporalModule,
    TerminusModule,
    TenantModule,
    WebhookModule,
    GateModule,
  ],
  controllers: [HealthController, WorkflowsController, CostController, MetricsController],
  providers: [BootstrapService],
})
export class AppModule {}
