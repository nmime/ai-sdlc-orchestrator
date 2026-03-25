import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService, CreateTenantDto, UpdateTenantDto } from './tenant.service';
import { ResultUtils } from '@app/common';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';

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
  @ApiOperation({ summary: 'List all tenants' })
  async list() {
    return ResultUtils.unwrapOrThrow(await this.tenantService.list());
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Param('id') id: string) {
    return ResultUtils.unwrapOrThrow(await this.tenantService.findById(id));
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return ResultUtils.unwrapOrThrow(await this.tenantService.update(id, dto));
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant (soft)' })
  async delete(@Param('id') id: string) {
    ResultUtils.unwrapOrThrow(await this.tenantService.delete(id));
  }
}
