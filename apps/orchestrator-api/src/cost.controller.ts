import { Controller, Get, Param, Query, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { AgentSession, CostAlert, Tenant, WorkflowMirror } from '@app/db';

@ApiTags('costs')
@Controller('costs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class CostController {
  constructor(private readonly em: EntityManager) {}

  @Get('tenants/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get monthly cost breakdown for tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Monthly cost breakdown' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Tenant mismatch' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantCosts(@Param('tenantId') tenantId: string, @TenantId() authTenantId: string): Promise<Record<string, unknown>> {
    if (authTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    const tenant = await this.em.findOne(Tenant, { id: tenantId });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const conn = this.em.getConnection();
    const resultRows = await conn.execute<Array<{ count: string; total_ai: string; total_sandbox: string }>>(
      `SELECT COUNT(*) as count, COALESCE(SUM(ai_cost_usd), 0) as total_ai, COALESCE(SUM(sandbox_cost_usd), 0) as total_sandbox FROM workflow_mirror WHERE tenant_id = ? AND created_at >= ?`,
      [tenantId, startOfMonth.toISOString()],
    );
    const r = resultRows[0] ?? { count: '0', total_ai: '0', total_sandbox: '0' };
    const totalAi = Number(r.total_ai);
    const totalSandbox = Number(r.total_sandbox);

    return {
      tenantId,
      month: now.toISOString().slice(0, 7),
      aiCostUsd: totalAi,
      sandboxCostUsd: totalSandbox,
      totalCostUsd: totalAi + totalSandbox,
      limitUsd: Number(tenant.monthlyCostLimitUsd),
      reservedUsd: Number(tenant.monthlyCostReservedUsd),
      actualUsd: Number(tenant.monthlyCostActualUsd),
      workflowCount: Number(r.count),
    };
  }

  @Get('tenants/:tenantId/alerts')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost alerts for tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of alerts (default 50, max 200)' })
  @ApiResponse({ status: 200, description: 'Cost alerts list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Tenant mismatch' })
  async getTenantAlerts(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit: string | undefined,
    @TenantId() authTenantId: string,
  ): Promise<CostAlert[]> {
    if (authTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    return this.em.find(CostAlert, { tenant: tenantId }, {
      orderBy: { createdAt: 'DESC' },
      limit: Math.min(parseInt(limit || '50', 10) || 50, 200),
    });
  }

  @Get('workflows/:workflowId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost breakdown for a workflow' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow cost breakdown with session details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getWorkflowCost(@TenantId() tenantId: string, @Param('workflowId') workflowId: string): Promise<Record<string, unknown>> {
    const mirror = await this.em.findOne(WorkflowMirror, { temporalWorkflowId: workflowId, tenant: tenantId });
    if (!mirror) throw new NotFoundException(`Workflow ${workflowId} not found`);
    const sessions: AgentSession[] = await this.em.find(AgentSession, { workflow: mirror.id }, { limit: 200 });

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
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Costs grouped by repository' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Tenant mismatch' })
  async getCostsByRepo(@Param('tenantId') tenantId: string, @TenantId() authTenantId: string): Promise<Record<string, unknown>[]> {
    if (authTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const conn = this.em.getConnection();
    const rows = await conn.execute<Array<{ repo_id: string; ai: string; sandbox: string; count: string }>>(
      `SELECT repo_id, COALESCE(SUM(ai_cost_usd), 0) as ai, COALESCE(SUM(sandbox_cost_usd), 0) as sandbox, COUNT(*) as count FROM workflow_mirror WHERE tenant_id = ? AND created_at >= ? GROUP BY repo_id`,
      [tenantId, startOfMonth.toISOString()],
    );

    return rows.map(row => ({
      repoId: row.repo_id,
      aiCostUsd: Number(row.ai),
      sandboxCostUsd: Number(row.sandbox),
      totalCostUsd: Number(row.ai) + Number(row.sandbox),
      workflowCount: Number(row.count),
    }));
  }
}
