import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { WorkflowDsl, Tenant } from '@app/db';
import { IsString, IsObject, IsOptional, IsBoolean } from 'class-validator';

class CreateDslDto {
  @IsString()
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
  async list(@Param('tenantId') tenantId: string): Promise<WorkflowDsl[]> {
    return this.em.find(WorkflowDsl, { tenant: tenantId }, { orderBy: { name: 'ASC', version: 'DESC' } });
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get DSL by ID' })
  async get(@Param('id') id: string): Promise<WorkflowDsl> {
    return this.em.findOneOrFail(WorkflowDsl, { id });
  }

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Create a new DSL version' })
  async create(@Param('tenantId') tenantId: string, @Body() body: CreateDslDto): Promise<WorkflowDsl> {
    const existing = await this.em.find(WorkflowDsl, { tenant: tenantId, name: body.name }, { orderBy: { version: 'DESC' }, limit: 1 });
    const nextVersion = existing.length > 0 ? existing[0]!.version + 1 : 1;

    const dsl = new WorkflowDsl();
    dsl.tenant = this.em.getReference(Tenant, tenantId);
    dsl.name = body.name;
    dsl.version = nextVersion;
    dsl.definition = body.definition;
    dsl.isActive = body.isActive ?? true;
    await this.em.persistAndFlush(dsl);
    return dsl;
  }

  @Put(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Update DSL' })
  async update(@Param('id') id: string, @Body() body: UpdateDslDto): Promise<WorkflowDsl> {
    const dsl = await this.em.findOneOrFail(WorkflowDsl, { id });
    if (body.definition !== undefined) dsl.definition = body.definition;
    if (body.isActive !== undefined) dsl.isActive = body.isActive;
    await this.em.flush();
    return dsl;
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete DSL' })
  async delete(@Param('id') id: string): Promise<void> {
    const dsl = await this.em.findOneOrFail(WorkflowDsl, { id });
    await this.em.removeAndFlush(dsl);
  }
}
