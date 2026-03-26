import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService, CreateTenantDto, UpdateTenantDto } from './tenant.service';
import { ResultUtils } from '@app/common';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import type { FastifyRequest } from 'fastify';

@ApiTags('tenants')
@Controller('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new tenant' })
  async create(@Body() dto: CreateTenantDto) {
    return ResultUtils.unwrapOrThrow(await this.tenantService.create(dto));
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List tenants for current user' })
  async list(@Req() req: FastifyRequest) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    const tenant = ResultUtils.unwrapOrThrow(await this.tenantService.findById(tenantId));
    return [tenant];
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId || tenantId !== id) throw new ForbiddenException('Access denied for this tenant');
    return ResultUtils.unwrapOrThrow(await this.tenantService.findById(id));
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId || tenantId !== id) throw new ForbiddenException('Access denied for this tenant');
    return ResultUtils.unwrapOrThrow(await this.tenantService.update(id, dto));
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant (soft)' })
  async delete(@Req() req: FastifyRequest, @Param('id') id: string) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId || tenantId !== id) throw new ForbiddenException('Access denied for this tenant');
    ResultUtils.unwrapOrThrow(await this.tenantService.delete(id));
  }
}
