import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@ai-sdlc/feature-tenant';

@ApiTags('test')
@Controller('test')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TestController {
  @Post('mcp-connectivity')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test MCP server connectivity' })
  async testMcpConnectivity() {
    return { status: 'ok', message: 'MCP connectivity test placeholder' };
  }

  @Post('sandbox')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test sandbox boot and health' })
  async testSandbox() {
    return { status: 'ok', message: 'Sandbox test placeholder' };
  }

  @Post('agent-dry-run')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test agent invocation with mock task' })
  async testAgentDryRun() {
    return { status: 'ok', message: 'Agent dry-run placeholder' };
  }
}
