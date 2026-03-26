import { Controller, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { TemporalClientService } from '@app/common';
import { TenantMcpServer, TenantRepoConfig } from '@app/db';
import { FastifyRequest } from 'fastify';

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
  async testMcpConnectivity(@Body() body: { tenantId: string; serverName?: string }, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== body.tenantId) throw new ForbiddenException('Tenant mismatch');

    const where: Record<string, unknown> = { tenant: body.tenantId, isEnabled: true };
    if (body.serverName) where['name'] = body.serverName;
    const servers = await this.em.find(TenantMcpServer, where);

    const results = await Promise.all(servers.map(async (server) => {
      if (server.url) {
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
  async testSandbox(@Body() body: { tenantId: string }, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
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
  async testAgentDryRun(@Body() body: { tenantId: string; repoId?: string }, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
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
