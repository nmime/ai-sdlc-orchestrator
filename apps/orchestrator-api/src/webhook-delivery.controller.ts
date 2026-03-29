import { Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { WebhookDelivery } from '@app/db';
import { type WebhookDeliveryListQueryDto, PaginatedResponseDto } from '@app/common';

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
    @Query() query: WebhookDeliveryListQueryDto,
    @TenantId() authTenantId: string,
  ): Promise<PaginatedResponseDto<WebhookDelivery>> {
    if (authTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    const where: Record<string, unknown> = { tenant: tenantId };
    if (query.status) where['status'] = query.status;
    if (query.platform) where['platform'] = query.platform;

    const [deliveries, total] = await this.em.findAndCount(
      WebhookDelivery,
      where,
      {
        orderBy: { createdAt: 'DESC' },
        limit: query.limit,
        offset: query.offset,
      },
    );

    return PaginatedResponseDto.of(deliveries, total, query.limit, query.offset);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get webhook delivery by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string, @TenantId() authTenantId: string): Promise<WebhookDelivery> {
    if (authTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return this.em.findOneOrFail(WebhookDelivery, { id, tenant: tenantId });
  }
}
