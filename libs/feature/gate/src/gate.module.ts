import { Module } from '@nestjs/common';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { LoggerModule, TemporalModule } from '@ai-sdlc/common';
import { TenantModule } from '@ai-sdlc/feature-tenant';

@Module({
  imports: [TenantModule, LoggerModule, TemporalModule],
  controllers: [GateController],
  providers: [GateService],
  exports: [GateService],
})
export class GateModule {}
