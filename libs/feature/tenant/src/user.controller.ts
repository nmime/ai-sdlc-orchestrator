import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ResultUtils } from '@app/common';
import { TenantService } from './tenant.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import type { TenantRole } from '@app/db';

export class AddUserDto {
  @IsString()
  externalId!: string;

  @IsString()
  provider!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
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
  async addUser(@Param('tenantId') tenantId: string, @Body() dto: AddUserDto) {
    return ResultUtils.unwrapOrThrow(
      await this.tenantService.addUser(tenantId, dto.externalId, dto.provider, dto.email, (dto.role || 'viewer') as TenantRole),
    );
  }

  @Get()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'List users for tenant' })
  async listUsers(@Param('tenantId') tenantId: string) {
    return ResultUtils.unwrapOrThrow(await this.tenantService.getUsers(tenantId));
  }
}
