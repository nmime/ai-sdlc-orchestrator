import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResultUtils } from '@app/common';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { TenantMcpServerService, CreateMcpServerDto, UpdateMcpServerDto } from './tenant-mcp-server.service';
import { TenantVcsCredentialService, CreateVcsCredentialDto, UpdateVcsCredentialDto } from './tenant-vcs-credential.service';
import { TenantRepoConfigService, CreateRepoConfigDto, UpdateRepoConfigDto } from './tenant-repo-config.service';
import { TenantWebhookConfigService, CreateWebhookConfigDto, UpdateWebhookConfigDto } from './tenant-webhook-config.service';

@ApiTags('tenant-mcp-servers')
@Controller('tenants/:tenantId/mcp-servers')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantMcpServerController {
  constructor(private readonly service: TenantMcpServerService) {}

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Add MCP server to tenant' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateMcpServerDto) {
    return ResultUtils.unwrapOrThrow(await this.service.create(tenantId, dto));
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List MCP servers for tenant' })
  async list(@Param('tenantId') tenantId: string) {
    return ResultUtils.unwrapOrThrow(await this.service.list(tenantId));
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get MCP server by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return ResultUtils.unwrapOrThrow(await this.service.findById(tenantId, id));
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update MCP server' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateMcpServerDto) {
    return ResultUtils.unwrapOrThrow(await this.service.update(tenantId, id, dto));
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MCP server' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    ResultUtils.unwrapOrThrow(await this.service.delete(tenantId, id));
  }
}

@ApiTags('tenant-vcs-credentials')
@Controller('tenants/:tenantId/vcs-credentials')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantVcsCredentialController {
  constructor(private readonly service: TenantVcsCredentialService) {}

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Add VCS credential' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateVcsCredentialDto) {
    return ResultUtils.unwrapOrThrow(await this.service.create(tenantId, dto));
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List VCS credentials' })
  async list(@Param('tenantId') tenantId: string) {
    return ResultUtils.unwrapOrThrow(await this.service.list(tenantId));
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get VCS credential by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return ResultUtils.unwrapOrThrow(await this.service.findById(tenantId, id));
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update VCS credential' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateVcsCredentialDto) {
    return ResultUtils.unwrapOrThrow(await this.service.update(tenantId, id, dto));
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete VCS credential' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    ResultUtils.unwrapOrThrow(await this.service.delete(tenantId, id));
  }
}

@ApiTags('tenant-repo-configs')
@Controller('tenants/:tenantId/repo-configs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantRepoConfigController {
  constructor(private readonly service: TenantRepoConfigService) {}

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Add repo config' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateRepoConfigDto) {
    return ResultUtils.unwrapOrThrow(await this.service.create(tenantId, dto));
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List repo configs' })
  async list(@Param('tenantId') tenantId: string) {
    return ResultUtils.unwrapOrThrow(await this.service.list(tenantId));
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get repo config by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return ResultUtils.unwrapOrThrow(await this.service.findById(tenantId, id));
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update repo config' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateRepoConfigDto) {
    return ResultUtils.unwrapOrThrow(await this.service.update(tenantId, id, dto));
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete repo config' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    ResultUtils.unwrapOrThrow(await this.service.delete(tenantId, id));
  }
}

@ApiTags('tenant-webhook-configs')
@Controller('tenants/:tenantId/webhook-configs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantWebhookConfigController {
  constructor(private readonly service: TenantWebhookConfigService) {}

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Add webhook config' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateWebhookConfigDto) {
    return ResultUtils.unwrapOrThrow(await this.service.create(tenantId, dto));
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List webhook configs' })
  async list(@Param('tenantId') tenantId: string) {
    return ResultUtils.unwrapOrThrow(await this.service.list(tenantId));
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get webhook config by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return ResultUtils.unwrapOrThrow(await this.service.findById(tenantId, id));
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update webhook config' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateWebhookConfigDto) {
    return ResultUtils.unwrapOrThrow(await this.service.update(tenantId, id, dto));
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook config' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    ResultUtils.unwrapOrThrow(await this.service.delete(tenantId, id));
  }
}
