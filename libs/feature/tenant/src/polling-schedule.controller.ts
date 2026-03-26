import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { PollingSchedule, Tenant, TenantRepoConfig } from '@app/db';
import { IsString, IsOptional, IsBoolean, IsInt, IsObject } from 'class-validator';

class CreatePollingScheduleDto {
  @IsString()
  repoConfigId!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsObject()
  queryFilter?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  pollIntervalSeconds?: number;
}

class UpdatePollingScheduleDto {
  @IsOptional()
  @IsObject()
  queryFilter?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  pollIntervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@ApiTags('polling-schedules')
@Controller('tenants/:tenantId/polling-schedules')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class PollingScheduleController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List polling schedules' })
  async list(@Param('tenantId') tenantId: string): Promise<PollingSchedule[]> {
    return this.em.find(PollingSchedule, { tenant: tenantId });
  }

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Create polling schedule' })
  async create(@Param('tenantId') tenantId: string, @Body() body: CreatePollingScheduleDto): Promise<PollingSchedule> {
    const schedule = new PollingSchedule();
    schedule.tenant = this.em.getReference(Tenant, tenantId);
    schedule.repoConfig = this.em.getReference(TenantRepoConfig, body.repoConfigId);
    schedule.platform = body.platform;
    if (body.queryFilter) schedule.queryFilter = body.queryFilter;
    if (body.pollIntervalSeconds) schedule.pollIntervalSeconds = body.pollIntervalSeconds;
    await this.em.persistAndFlush(schedule);
    return schedule;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update polling schedule' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() body: UpdatePollingScheduleDto): Promise<PollingSchedule> {
    const schedule = await this.em.findOneOrFail(PollingSchedule, { id, tenant: tenantId });
    if (body.queryFilter !== undefined) schedule.queryFilter = body.queryFilter;
    if (body.pollIntervalSeconds !== undefined) schedule.pollIntervalSeconds = body.pollIntervalSeconds;
    if (body.enabled !== undefined) schedule.enabled = body.enabled;
    await this.em.flush();
    return schedule;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete polling schedule' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string): Promise<void> {
    const schedule = await this.em.findOneOrFail(PollingSchedule, { id, tenant: tenantId });
    await this.em.removeAndFlush(schedule);
  }
}
