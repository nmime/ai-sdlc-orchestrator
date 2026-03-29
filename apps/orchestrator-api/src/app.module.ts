import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule, LoggerModule, DatabaseModule, TemporalModule, MinioModule, RequestIdMiddleware } from '@app/common';
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
import { MultiRepoController } from './multi-repo.controller';
import { ArtifactController } from './artifact.controller';
import { MetricsModule } from './metrics/metrics.module';
import { CostResetService } from './cost-reset.service';
import { NotificationService } from './notification.service';

const isProduction = process.env['NODE_ENV'] === 'production';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    LoggerModule,
    DatabaseModule,
    TemporalModule,
    TerminusModule,
    ScheduleModule.forRoot(),
    TenantModule,
    WebhookModule,
    GateModule,
    WorkflowModule,
    MetricsModule,
    MinioModule,
  ],
  controllers: [
    HealthController, WorkflowsController, CostController,
    WebhookDeliveryController, SseController,
    MultiRepoController, ArtifactController,
    ...(isProduction ? [] : [TestController]),
  ],
  providers: [BootstrapService, CostResetService, NotificationService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
