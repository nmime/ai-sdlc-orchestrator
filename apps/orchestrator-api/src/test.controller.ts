import { Controller, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { TemporalClientService } from '@app/common';
import { TenantMcpServer, TenantRepoConfig } from '@app/db';
import { FastifyRequest } from 'fastify';
import { IsString, IsOptional, MaxLength } from 'class-validator';

function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname === '0.0.0.0') return true;
    if (hostname.includes(':')) return true;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

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
  async testMcpConnectivity(@Body() body: TestMcpConnectivityDto, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

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
  async testSandbox(@Body() body: TestSandboxDto, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

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
  async testAgentDryRun(@Body() body: TestAgentDryRunDto, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

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
