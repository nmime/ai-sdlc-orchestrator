import { Controller, Post, Get, Body, Param, UseGuards, Req, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ResultUtils } from '@app/common';
import { TenantService } from './tenant.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import type { TenantRole } from '@app/db';
import type { FastifyRequest } from 'fastify';

export class AddUserDto {
  @IsString()
  @MaxLength(255)
  externalId!: string;

  @IsString()
  @MaxLength(255)
  provider!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: string;
}

@ApiTags('tenant-users')
@Controller('tenants/:tenantId/users')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class UserController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Add user to tenant' })
  async addUser(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() dto: AddUserDto, @Req() req: FastifyRequest) {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return ResultUtils.unwrapOrThrow(
      await this.tenantService.addUser(tenantId, dto.externalId, dto.provider, dto.email, (dto.role || 'viewer') as TenantRole),
    );
  }

  @Get()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'List users for tenant' })
  async listUsers(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Req() req: FastifyRequest) {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');
    return ResultUtils.unwrapOrThrow(await this.tenantService.getUsers(tenantId));
  }
}
