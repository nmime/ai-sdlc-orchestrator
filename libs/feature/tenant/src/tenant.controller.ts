import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService, CreateTenantDto, UpdateTenantDto } from './tenant.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import type { AuthenticatedRequest } from '@ai-sdlc/common';

@ApiTags('tenants')
@Controller('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  private assertTenantAccess(req: AuthenticatedRequest, targetTenantId: string): void {
    if (req.user.tenantId !== targetTenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTenantDto) {
    const result = await this.tenantService.create(dto);
    if (result.isErr()) throw new BadRequestException('Failed to create tenant');
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get own tenant' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  async list(@Req() req: AuthenticatedRequest) {
    const result = await this.tenantService.findById(req.user.tenantId);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return [result.value];
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findById(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.findById(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async update(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.update(id, dto);
    if (result.isErr()) throw new BadRequestException('Failed to update tenant');
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant (soft)' })
  @ApiResponse({ status: 204, description: 'Tenant deleted' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async delete(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.delete(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
  }

  @Delete(':id/data')
  @Roles('admin')
  @ApiOperation({ summary: 'Permanently purge all tenant data (GDPR right-to-erasure)' })
  @ApiResponse({ status: 200, description: 'Data purged with deletion counts' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async purgeData(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.purgeData(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }

  @Get(':id/export')
  @Roles('admin')
  @ApiOperation({ summary: 'Export all tenant data (GDPR data subject access request)' })
  @ApiResponse({ status: 200, description: 'Exported tenant data' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async exportData(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.exportData(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }
}
