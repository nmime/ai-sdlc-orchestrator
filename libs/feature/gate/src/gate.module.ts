import { Module } from '@nestjs/common';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { TenantModule } from '@ai-sdlc/feature-tenant';

@Module({
  imports: [TenantModule],
  controllers: [GateController],
  providers: [GateService],
  exports: [GateService],
})
export class GateModule {}
