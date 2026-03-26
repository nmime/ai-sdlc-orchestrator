import { Controller, Get, Param, Query, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { Tenant, AgentSession, CostAlert } from '@ai-sdlc/db';
import { AuthGuard, RbacGuard, Roles } from '@ai-sdlc/feature-tenant';

@ApiTags('costs')
@Controller('costs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class CostController {
  constructor(private readonly em: EntityManager) {}

  private assertTenantAccess(req: any, tenantId: string): void {
    if (req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }
  }

  @Get('summary/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost summary for tenant' })
  async getCostSummary(@Req() req: any, @Param('tenantId') tenantId: string) {
    this.assertTenantAccess(req, tenantId);
    const tenant = await this.em.findOneOrFail(Tenant, { id: tenantId });

    return {
      tenantId,
      monthlyCostLimitUsd: tenant.monthlyCostLimitUsd,
      monthlyCostActualUsd: tenant.monthlyCostActualUsd,
      monthlyCostReservedUsd: tenant.monthlyCostReservedUsd,
      monthlyAiCostActualUsd: tenant.monthlyAiCostActualUsd,
      monthlySandboxCostActualUsd: tenant.monthlySandboxCostActualUsd,
      remainingUsd: Math.max(0, Number(tenant.monthlyCostLimitUsd) - Number(tenant.monthlyCostActualUsd) - Number(tenant.monthlyCostReservedUsd)),
    };
  }

  @Get('sessions/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get recent agent sessions with costs' })
  async getRecentSessions(
    @Req() req: any,
    @Param('tenantId') tenantId: string,
    @Query('limit') limit: number = 20,
  ) {
    this.assertTenantAccess(req, tenantId);
    return this.em.find(
      AgentSession,
      { workflow: { tenant: tenantId } },
      { limit: Math.min(limit, 100), orderBy: { startedAt: 'DESC' } },
    );
  }

  @Get('alerts/:tenantId')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get cost alerts for tenant' })
  async getAlerts(@Req() req: any, @Param('tenantId') tenantId: string) {
    this.assertTenantAccess(req, tenantId);
    return this.em.find(CostAlert, { tenant: tenantId }, {
      orderBy: { createdAt: 'DESC' },
    });
  }
}
