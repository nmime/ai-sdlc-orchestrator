import { Module } from '@nestjs/common';
import { LoggerModule } from '@ai-sdlc/common';
import { AlertService } from './alert.service';

@Module({
  imports: [LoggerModule],
  providers: [AlertService],
  exports: [AlertService],
})
export class WorkflowModule {}
