import { Controller, Post, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import type { EntityManager } from '@mikro-orm/postgresql';
import { type TemporalClientService, isInternalUrl } from '@app/common';
import { TenantMcpServer, TenantRepoConfig } from '@app/db';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class TestMcpConnectivityDto {
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  serverName?: string;
}

export class TestSandboxDto {
  @IsString()
  @MaxLength(255)
  tenantId!: string;
}

export class TestAgentDryRunDto {
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  repoId?: string;
}

@ApiTags('test')
@Controller('test')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TestController {
  constructor(
    private readonly em: EntityManager,
    private readonly temporalClient: TemporalClientService,
  ) {}

  @Post('mcp-connectivity')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test MCP server connectivity' })
  async testMcpConnectivity(@Body() body: TestMcpConnectivityDto, @TenantId() authTenantId: string): Promise<Record<string, unknown>> {
    if (authTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

    const where: Record<string, unknown> = { tenant: body.tenantId, isEnabled: true };
    if (body.serverName) where['name'] = body.serverName;
    const servers = await this.em.find(TenantMcpServer, where, { limit: 200 });

    const results = await Promise.all(servers.map(async (server) => {
      if (server.url) {
        if (isInternalUrl(server.url)) {
          return { name: server.name, status: 'blocked_internal', transport: server.transport };
        }
        try {
          const res = await fetch(server.url, { method: 'GET', signal: AbortSignal.timeout(5_000) });
          return { name: server.name, status: res.ok ? 'reachable' : `http_${res.status}`, transport: server.transport };
        } catch (error) {
          return { name: server.name, status: 'unreachable', error: (error as Error).message, transport: server.transport };
        }
      }
      return { name: server.name, status: 'stdio_only', transport: server.transport };
    }));

    return { tested: results.length, results };
  }

  @Post('sandbox')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test sandbox boot and health' })
  async testSandbox(@Body() body: TestSandboxDto, @TenantId() authTenantId: string): Promise<Record<string, unknown>> {
    if (authTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

    try {
      const client = await this.temporalClient.getClient();
      const workflowId = `test-sandbox-${body.tenantId}-${Date.now()}`;
      await client.workflow.start('orchestrateTaskWorkflow', {
        taskQueue: 'orchestrator-queue',
        workflowId,
        args: [{
          tenantId: body.tenantId,
          taskId: `test-${Date.now()}`,
          taskProvider: 'manual',
          repoId: 'test',
          repoUrl: '',
          webhookDeliveryId: 'test',
          dryRun: true,
        }],
      });
      return { status: 'started', workflowId, message: 'Sandbox test workflow initiated' };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }

  @Post('agent-dry-run')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Test agent invocation with mock task' })
  async testAgentDryRun(@Body() body: TestAgentDryRunDto, @TenantId() authTenantId: string): Promise<Record<string, unknown>> {
    if (authTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

    const repoConfig = body.repoId
      ? await this.em.findOne(TenantRepoConfig, { tenant: body.tenantId, repoId: body.repoId })
      : await this.em.findOne(TenantRepoConfig, { tenant: body.tenantId });

    if (!repoConfig) return { status: 'error', message: 'No repo config found for tenant' };

    try {
      const client = await this.temporalClient.getClient();
      const workflowId = `test-agent-${body.tenantId}-${Date.now()}`;
      await client.workflow.start('orchestrateTaskWorkflow', {
        taskQueue: 'orchestrator-queue',
        workflowId,
        args: [{
          tenantId: body.tenantId,
          taskId: `dry-run-${Date.now()}`,
          taskProvider: 'manual',
          repoId: repoConfig.repoId,
          repoUrl: repoConfig.repoUrl,
          webhookDeliveryId: 'dry-run',
          labels: ['dry-run'],
        }],
      });
      return { status: 'started', workflowId, repoId: repoConfig.repoId, message: 'Agent dry-run workflow initiated' };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }
}
