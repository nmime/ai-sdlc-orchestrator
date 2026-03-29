import { Module } from '@nestjs/common';
import { LoggerModule } from '@app/common';
import { AlertService } from './alert.service';

@Module({
  imports: [LoggerModule],
  providers: [AlertService],
  exports: [AlertService],
})
export class WorkflowModule {}
