import { Controller, Get, Param, Query, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { WebhookDelivery, DeliveryStatus, WebhookPlatform } from '@app/db';
import { FastifyRequest } from 'fastify';

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
    @Req() req?: FastifyRequest,
  ): Promise<{ data: WebhookDelivery[]; total: number; limit: number; offset: number }> {
    const userTenantId = (req as any)?.user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    if (status && !Object.values(DeliveryStatus).includes(status as DeliveryStatus)) {
      throw new BadRequestException('Invalid status');
    }
    if (platform && !Object.values(WebhookPlatform).includes(platform as WebhookPlatform)) {
      throw new BadRequestException('Invalid platform');
    }

    const where: Record<string, unknown> = { tenant: tenantId };
    if (status) where['status'] = status;
    if (platform) where['platform'] = platform;

    const [deliveries, total] = await this.em.findAndCount(
      WebhookDelivery,
      where,
      {
        orderBy: { createdAt: 'DESC' },
        limit: Math.min(parseInt(limit || '50', 10), 200),
        offset: Math.max(parseInt(offset || '0', 10), 0),
      },
    );

    return { data: deliveries, total, limit: Math.min(parseInt(limit || '50', 10), 200), offset: Math.max(parseInt(offset || '0', 10), 0) };
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get webhook delivery by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string, @Req() req?: FastifyRequest): Promise<WebhookDelivery> {
    const userTenantId = (req as any)?.user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    return this.em.findOneOrFail(WebhookDelivery, { id, tenant: tenantId });
  }
}
