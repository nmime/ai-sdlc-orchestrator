import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Req, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { PollingSchedule, Tenant, TenantRepoConfig } from '@app/db';
import { IsString, IsOptional, IsBoolean, IsInt, IsObject, MaxLength } from 'class-validator';
import { sanitizeRecord } from '@app/common';
import type { FastifyRequest } from 'fastify';

class CreatePollingScheduleDto {
  @IsString()
  @MaxLength(255)
  repoConfigId!: string;

  @IsString()
  @MaxLength(255)
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
  async list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Req() req: FastifyRequest): Promise<PollingSchedule[]> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return this.em.find(PollingSchedule, { tenant: tenantId }, { limit: 200 });
  }

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Create polling schedule' })
  async create(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() body: CreatePollingScheduleDto, @Req() req: FastifyRequest): Promise<PollingSchedule> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const repoConfig = await this.em.findOneOrFail(TenantRepoConfig, { id: body.repoConfigId, tenant: tenantId });
    const schedule = new PollingSchedule();
    schedule.tenant = this.em.getReference(Tenant, tenantId);
    schedule.repoConfig = repoConfig;
    schedule.platform = body.platform;
    if (body.queryFilter) {
      try {
        schedule.queryFilter = sanitizeRecord(body.queryFilter);
      } catch {
        throw new BadRequestException('Invalid queryFilter object');
      }
    }
    if (body.pollIntervalSeconds) schedule.pollIntervalSeconds = body.pollIntervalSeconds;
    await this.em.persistAndFlush(schedule);
    return schedule;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update polling schedule' })
  async update(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePollingScheduleDto, @Req() req: FastifyRequest): Promise<PollingSchedule> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const schedule = await this.em.findOneOrFail(PollingSchedule, { id, tenant: tenantId });
    if (body.queryFilter !== undefined) {
      try {
        schedule.queryFilter = sanitizeRecord(body.queryFilter);
      } catch {
        throw new BadRequestException('Invalid queryFilter object');
      }
    }
    if (body.pollIntervalSeconds !== undefined) schedule.pollIntervalSeconds = body.pollIntervalSeconds;
    if (body.enabled !== undefined) schedule.enabled = body.enabled;
    await this.em.flush();
    return schedule;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete polling schedule' })
  async delete(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest): Promise<void> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const schedule = await this.em.findOneOrFail(PollingSchedule, { id, tenant: tenantId });
    await this.em.removeAndFlush(schedule);
  }
}
