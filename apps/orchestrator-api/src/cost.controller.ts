import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { Tenant, AgentSession, CostAlert } from '@ai-sdlc/db';

@ApiTags('costs')
@Controller('costs')
@ApiBearerAuth()
export class CostController {
  constructor(private readonly em: EntityManager) {}

  @Get('summary/:tenantId')
  @ApiOperation({ summary: 'Get cost summary for tenant' })
  async getCostSummary(@Param('tenantId') tenantId: string) {
    const tenant = await this.em.findOneOrFail(Tenant, { id: tenantId });

    return {
      tenantId,
      budgetLimitUsd: tenant.budgetLimitUsd,
      budgetUsedUsd: tenant.budgetUsedUsd,
      aiBudgetUsedUsd: tenant.aiBudgetUsedUsd,
      sandboxBudgetUsedUsd: tenant.sandboxBudgetUsedUsd,
      remainingUsd: Math.max(0, Number(tenant.budgetLimitUsd) - Number(tenant.budgetUsedUsd)),
    };
  }

  @Get('sessions/:tenantId')
  @ApiOperation({ summary: 'Get recent agent sessions with costs' })
  async getRecentSessions(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.em.find(
      AgentSession,
      { workflow: { tenant: tenantId } },
      { limit, orderBy: { startedAt: 'DESC' } },
    );
  }

  @Get('alerts/:tenantId')
  @ApiOperation({ summary: 'Get cost alerts for tenant' })
  async getAlerts(@Param('tenantId') tenantId: string) {
    return this.em.find(CostAlert, { tenant: tenantId }, {
      orderBy: { createdAt: 'DESC' },
    });
  }
}
