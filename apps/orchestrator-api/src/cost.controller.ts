import { Controller, Get, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { WorkflowMirror, AgentSession, CostAlert, Tenant } from '@app/db';
import { FastifyRequest } from 'fastify';

@ApiTags('costs')
@Controller('costs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class CostController {
  constructor(private readonly em: EntityManager) {}

  @Get('tenants/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get monthly cost breakdown for tenant' })
  async getTenantCosts(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest): Promise<Record<string, unknown>> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    const tenant = await this.em.findOneOrFail(Tenant, { id: tenantId });

    const qb = this.em.createQueryBuilder(WorkflowMirror, 'wm');
    const result = await qb
      .select([
        'COUNT(*) as count',
        'COALESCE(SUM(wm.ai_cost_usd), 0) as total_ai',
        'COALESCE(SUM(wm.sandbox_cost_usd), 0) as total_sandbox',
      ])
      .where({ tenant: tenantId })
      .execute('get') as { count: string; total_ai: string; total_sandbox: string };

    const totalAi = Number(result.total_ai);
    const totalSandbox = Number(result.total_sandbox);

    return {
      tenantId,
      month: new Date().toISOString().slice(0, 7),
      aiCostUsd: totalAi,
      sandboxCostUsd: totalSandbox,
      totalCostUsd: totalAi + totalSandbox,
      limitUsd: Number(tenant.monthlyCostLimitUsd),
      reservedUsd: Number(tenant.monthlyCostReservedUsd),
      actualUsd: Number(tenant.monthlyCostActualUsd),
      workflowCount: Number(result.count),
    };
  }

  @Get('tenants/:tenantId/alerts')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost alerts for tenant' })
  async getTenantAlerts(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
    @Req() req?: FastifyRequest,
  ): Promise<CostAlert[]> {
    const userTenantId = (req as any)?.user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    return this.em.find(CostAlert, { tenant: tenantId }, {
      orderBy: { createdAt: 'DESC' },
      limit: Math.min(parseInt(limit || '50', 10) || 50, 200),
    });
  }

  @Get('workflows/:workflowId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost breakdown for a workflow' })
  async getWorkflowCost(@Req() req: FastifyRequest, @Param('workflowId') workflowId: string): Promise<Record<string, unknown>> {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: workflowId, tenant: tenantId });
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id });

    return {
      workflowId,
      totalCostUsd: Number(mirror.costUsdTotal),
      aiCostUsd: Number(mirror.aiCostUsd),
      sandboxCostUsd: Number(mirror.sandboxCostUsd),
      sessions: sessions.map(s => ({
        id: s.id,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        aiCostUsd: Number(s.aiCostUsd),
        sandboxCostUsd: Number(s.sandboxCostUsd),
        totalCostUsd: Number(s.totalCostUsd),
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        duration: s.completedAt && s.startedAt
          ? (s.completedAt.getTime() - s.startedAt.getTime()) / 1000
          : null,
      })),
    };
  }

  @Get('tenants/:tenantId/by-repo')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get costs grouped by repo' })
  async getCostsByRepo(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest): Promise<Record<string, unknown>[]> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    const qb = this.em.createQueryBuilder(WorkflowMirror, 'wm');
    const rows = await qb
      .select([
        'wm.repo_id as repo_id',
        'COALESCE(SUM(wm.ai_cost_usd), 0) as ai',
        'COALESCE(SUM(wm.sandbox_cost_usd), 0) as sandbox',
        'COUNT(*) as count',
      ])
      .where({ tenant: tenantId })
      .groupBy('wm.repo_id')
      .execute('all') as Array<{ repo_id: string; ai: string; sandbox: string; count: string }>;

    return rows.map(row => ({
      repoId: row.repo_id,
      aiCostUsd: Number(row.ai),
      sandboxCostUsd: Number(row.sandbox),
      totalCostUsd: Number(row.ai) + Number(row.sandbox),
      workflowCount: Number(row.count),
    }));
  }
}
