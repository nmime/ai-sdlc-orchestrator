import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTenantDto) {
    const result = await this.tenantService.create(dto);
    if (result.isErr()) throw new BadRequestException('Failed to create tenant');
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get own tenant' })
  async list(@Req() req: AuthenticatedRequest) {
    const result = await this.tenantService.findById(req.user.tenantId);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return [result.value];
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.findById(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant' })
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
  async delete(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.delete(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
  }

  @Delete(':id/data')
  @Roles('admin')
  @ApiOperation({ summary: 'Permanently purge all tenant data (GDPR right-to-erasure)' })
  async purgeData(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.purgeData(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }

  @Get(':id/export')
  @Roles('admin')
  @ApiOperation({ summary: 'Export all tenant data (GDPR data subject access request)' })
  async exportData(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.assertTenantAccess(req, id);
    const result = await this.tenantService.exportData(id);
    if (result.isErr()) throw new NotFoundException('Tenant not found');
    return result.value;
  }
}
