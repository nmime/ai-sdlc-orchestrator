import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule, LoggerModule, DatabaseModule, TemporalModule } from '@app/common';
import { BootstrapService } from '@app/common';
import { TenantModule } from '@app/feature-tenant';
import { WebhookModule } from '@app/feature-webhook';
import { GateModule } from '@app/feature-gate';
import { WorkflowModule } from '@app/feature-workflow';
import { HealthController } from './health.controller';
import { WorkflowsController } from './workflows.controller';
import { CostController } from './cost.controller';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { TestController } from './test.controller';
import { SseController } from './sse.controller';
import { MetricsModule } from './metrics/metrics.module';

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
    WorkflowModule,
    MetricsModule,
  ],
  controllers: [HealthController, WorkflowsController, CostController, WebhookDeliveryController, TestController, SseController],
  providers: [BootstrapService],
})
export class AppModule {}
