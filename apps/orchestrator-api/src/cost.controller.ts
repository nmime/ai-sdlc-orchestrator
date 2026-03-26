import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { WorkflowMirror, AgentSession, CostAlert, Tenant } from '@app/db';

@ApiTags('costs')
@Controller('costs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class CostController {
  constructor(private readonly em: EntityManager) {}

  @Get('tenants/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get monthly cost breakdown for tenant' })
  async getTenantCosts(@Param('tenantId') tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.em.findOneOrFail(Tenant, { id: tenantId });
    const workflows: WorkflowMirror[] = await this.em.find(WorkflowMirror, { tenant: tenantId });

    let totalAi = 0;
    let totalSandbox = 0;
    for (const wf of workflows) {
      totalAi += Number(wf.aiCostUsd);
      totalSandbox += Number(wf.sandboxCostUsd);
    }

    return {
      tenantId,
      month: new Date().toISOString().slice(0, 7),
      aiCostUsd: totalAi,
      sandboxCostUsd: totalSandbox,
      totalCostUsd: totalAi + totalSandbox,
      limitUsd: Number(tenant.monthlyCostLimitUsd),
      reservedUsd: Number(tenant.monthlyCostReservedUsd),
      actualUsd: Number(tenant.monthlyCostActualUsd),
      workflowCount: workflows.length,
    };
  }

  @Get('tenants/:tenantId/alerts')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost alerts for tenant' })
  async getTenantAlerts(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ): Promise<CostAlert[]> {
    return this.em.find(CostAlert, { tenant: tenantId }, {
      orderBy: { createdAt: 'DESC' },
      limit: Math.min(parseInt(limit || '50', 10), 200),
    });
  }

  @Get('workflows/:workflowId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost breakdown for a workflow' })
  async getWorkflowCost(@Param('workflowId') workflowId: string): Promise<Record<string, unknown>> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: workflowId });
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
  async getCostsByRepo(@Param('tenantId') tenantId: string): Promise<Record<string, unknown>[]> {
    const workflows: WorkflowMirror[] = await this.em.find(WorkflowMirror, { tenant: tenantId });
    const byRepo = new Map<string, { ai: number; sandbox: number; count: number }>();

    for (const wf of workflows) {
      const existing = byRepo.get(wf.repoId) || { ai: 0, sandbox: 0, count: 0 };
      existing.ai += Number(wf.aiCostUsd);
      existing.sandbox += Number(wf.sandboxCostUsd);
      existing.count++;
      byRepo.set(wf.repoId, existing);
    }

    return Array.from(byRepo.entries()).map(([repoId, data]) => ({
      repoId,
      aiCostUsd: data.ai,
      sandboxCostUsd: data.sandbox,
      totalCostUsd: data.ai + data.sandbox,
      workflowCount: data.count,
    }));
  }
}
