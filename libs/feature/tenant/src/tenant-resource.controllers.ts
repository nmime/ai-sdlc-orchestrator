import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
    const result = await this.service.create(tenantId, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List MCP servers for tenant' })
  async list(@Param('tenantId') tenantId: string) {
    const result = await this.service.list(tenantId);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get MCP server by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.findById(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update MCP server' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateMcpServerDto) {
    const result = await this.service.update(tenantId, id, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MCP server' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.delete(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
  }
}

@ApiTags('tenant-vcs-credentials')
@Controller('tenants/:tenantId/vcs-credentials')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class TenantVcsCredentialController {
  constructor(private readonly service: TenantVcsCredentialService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Add VCS credential to tenant' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateVcsCredentialDto) {
    const result = await this.service.create(tenantId, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'List VCS credentials for tenant' })
  async list(@Param('tenantId') tenantId: string) {
    const result = await this.service.list(tenantId);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Get VCS credential by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.findById(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update VCS credential' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateVcsCredentialDto) {
    const result = await this.service.update(tenantId, id, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete VCS credential' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.delete(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
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
  @ApiOperation({ summary: 'Add repo config to tenant' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateRepoConfigDto) {
    const result = await this.service.create(tenantId, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List repo configs for tenant' })
  async list(@Param('tenantId') tenantId: string) {
    const result = await this.service.list(tenantId);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get repo config by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.findById(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update repo config' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateRepoConfigDto) {
    const result = await this.service.update(tenantId, id, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete repo config' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.delete(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
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
  @ApiOperation({ summary: 'Add webhook config to tenant' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateWebhookConfigDto) {
    const result = await this.service.create(tenantId, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List webhook configs for tenant' })
  async list(@Param('tenantId') tenantId: string) {
    const result = await this.service.list(tenantId);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get webhook config by ID' })
  async findById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.findById(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update webhook config' })
  async update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateWebhookConfigDto) {
    const result = await this.service.update(tenantId, id, dto);
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook config' })
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const result = await this.service.delete(tenantId, id);
    if (result.isErr()) throw new Error(result.error.message);
  }
}
