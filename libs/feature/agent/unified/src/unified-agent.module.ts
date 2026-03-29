import { Module } from '@nestjs/common';
import { UnifiedAgentAdapter } from './unified-agent.adapter';

@Module({
  providers: [UnifiedAgentAdapter],
  exports: [UnifiedAgentAdapter],
})
export class UnifiedAgentModule {}
