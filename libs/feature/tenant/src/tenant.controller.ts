import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService, CreateTenantDto, UpdateTenantDto } from './tenant.service';
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
    const result = await this.tenantService.create(dto);
    if (result.isErr()) throw new BadRequestException('Failed to create tenant');
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List all tenants' })
  async list() {
    const result = await this.tenantService.list();
    if (result.isErr()) throw new InternalServerErrorException('Failed to list tenants');
    return result.value;
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Param('id') id: string) {
    const result = await this.tenantService.findById(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const result = await this.tenantService.update(id, dto);
    if (result.isErr()) throw new BadRequestException('Failed to update tenant');
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant (soft)' })
  async delete(@Param('id') id: string) {
    const result = await this.tenantService.delete(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
  }
}
