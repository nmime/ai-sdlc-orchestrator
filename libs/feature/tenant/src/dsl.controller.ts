import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus, BadRequestException, Req, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { WorkflowDsl, Tenant } from '@app/db';
import { IsString, IsObject, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { sanitizeRecord } from '@app/common';
import type { FastifyRequest } from 'fastify';

class CreateDslDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsObject()
  definition!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateDslDto {
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('dsl')
@Controller('tenants/:tenantId/dsl')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class DslController {
  constructor(private readonly em: EntityManager) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'List workflow DSLs for tenant' })
  async list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Req() req: FastifyRequest): Promise<WorkflowDsl[]> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return this.em.find(WorkflowDsl, { tenant: tenantId }, { orderBy: { name: 'ASC', version: 'DESC' }, limit: 200 });
  }

  @Post('validate')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Validate a DSL definition' })
  async validate(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() body: { yaml?: string }, @Req() req: FastifyRequest): Promise<{ valid: boolean; errors: string[] }> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    if (!body.yaml || typeof body.yaml !== 'string' || body.yaml.trim().length === 0) {
      return { valid: false, errors: ['YAML content is required'] };
    }
    try {
      const hasName = /^name:/m.test(body.yaml);
      const hasSteps = /^steps:/m.test(body.yaml);
      const errors: string[] = [];
      if (!hasName) errors.push('Missing required field: name');
      if (!hasSteps) errors.push('Missing required field: steps');
      return { valid: errors.length === 0, errors };
    } catch {
      return { valid: false, errors: ['Failed to parse YAML'] };
    }
  }

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Create a new DSL version' })
  async create(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() body: CreateDslDto, @Req() req: FastifyRequest): Promise<WorkflowDsl> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const existing = await this.em.find(WorkflowDsl, { tenant: tenantId, name: body.name }, { orderBy: { version: 'DESC' }, limit: 1 });
    const nextVersion = existing.length > 0 ? (existing[0]?.version ?? 0) + 1 : 1;

    let definition: Record<string, unknown>;
    try {
      definition = sanitizeRecord(body.definition);
    } catch {
      throw new BadRequestException('Invalid definition object');
    }

    const dsl = new WorkflowDsl();
    dsl.tenant = this.em.getReference(Tenant, tenantId);
    dsl.name = body.name;
    dsl.version = nextVersion;
    dsl.definition = definition;
    dsl.isActive = body.isActive ?? true;
    await this.em.persistAndFlush(dsl);
    return dsl;
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get DSL by ID' })
  async get(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest): Promise<WorkflowDsl> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return this.em.findOneOrFail(WorkflowDsl, { id, tenant: tenantId });
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update DSL' })
  async update(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateDslDto, @Req() req: FastifyRequest): Promise<WorkflowDsl> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const dsl = await this.em.findOneOrFail(WorkflowDsl, { id, tenant: tenantId });
    if (body.definition !== undefined) {
      try {
        dsl.definition = sanitizeRecord(body.definition);
      } catch {
        throw new BadRequestException('Invalid definition object');
      }
    }
    if (body.isActive !== undefined) dsl.isActive = body.isActive;
    await this.em.flush();
    return dsl;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete DSL' })
  async delete(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest): Promise<void> {
    const userTenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    const dsl = await this.em.findOneOrFail(WorkflowDsl, { id, tenant: tenantId });
    await this.em.removeAndFlush(dsl);
  }
}
