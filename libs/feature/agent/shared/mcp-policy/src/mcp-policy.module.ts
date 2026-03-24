import { Module } from '@nestjs/common';
import { McpPolicyService } from './mcp-policy.service';

@Module({
  providers: [McpPolicyService],
  exports: [McpPolicyService],
})
export class McpPolicyModule {}
