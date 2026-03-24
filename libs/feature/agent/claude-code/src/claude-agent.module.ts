import { Module } from '@nestjs/common';
import { ClaudeAgentAdapter } from './claude-agent.adapter';

@Module({
  providers: [ClaudeAgentAdapter],
  exports: [ClaudeAgentAdapter],
})
export class ClaudeAgentModule {}
