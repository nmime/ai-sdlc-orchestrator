import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { WebhookDelivery } from '@app/db';

@ApiTags('webhook-deliveries')
@Controller('tenants/:tenantId/webhook-deliveries')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class WebhookDeliveryController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List webhook deliveries for tenant' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('platform') platform?: string,
  ): Promise<{ data: WebhookDelivery[]; total: number; limit: number; offset: number }> {
    const where: Record<string, unknown> = { tenant: tenantId };
    if (status) where['status'] = status;
    if (platform) where['platform'] = platform;

    const [deliveries, total] = await this.em.findAndCount(
      WebhookDelivery,
      where,
      {
        orderBy: { createdAt: 'DESC' },
        limit: parseInt(limit || '50', 10),
        offset: parseInt(offset || '0', 10),
      },
    );

    return { data: deliveries, total, limit: parseInt(limit || '50', 10), offset: parseInt(offset || '0', 10) };
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get webhook delivery by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string): Promise<WebhookDelivery> {
    return this.em.findOneOrFail(WebhookDelivery, { id, tenant: tenantId });
  }
}
