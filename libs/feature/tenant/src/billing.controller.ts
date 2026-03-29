import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ResultUtils } from '@app/common';
import type { BillingService } from './billing.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { TenantId } from './decorators/tenant-id.decorator';
import type { SubscriptionPlan } from '@app/db';

export class ChangePlanDto {
  @IsIn(['starter', 'pro', 'enterprise'])
  plan!: string;
}

@ApiTags('billing')
@Controller('tenants/:tenantId/billing')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List available plans' })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get current subscription' })
  async getSubscription(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @TenantId() userTenantId: string,
  ) {
    if (userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return ResultUtils.unwrapOrThrow(await this.billingService.getSubscription(tenantId));
  }

  @Post('change-plan')
  @Roles('admin')
  @ApiOperation({ summary: 'Change subscription plan' })
  async changePlan(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @TenantId() userTenantId: string,
    @Body() dto: ChangePlanDto,
  ) {
    if (userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return ResultUtils.unwrapOrThrow(await this.billingService.changePlan(tenantId, dto.plan as SubscriptionPlan));
  }
}
