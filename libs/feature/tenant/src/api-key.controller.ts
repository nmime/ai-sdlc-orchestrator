import { Controller, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResultUtils } from '@app/common';
import { ApiKeyService } from './api-key.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';
import { CreateApiKeyDto } from './dto';
import type { ApiKeyRole } from '@app/db';
import { FastifyRequest } from 'fastify';

@ApiTags('api-keys')
@Controller('tenants/:tenantId/api-keys')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Generate a new API key for tenant' })
  async generate(@Param('tenantId') tenantId: string, @Body() dto: CreateApiKeyDto, @Req() req: FastifyRequest) {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    return ResultUtils.unwrapOrThrow(await this.apiKeyService.generate(tenantId, dto.name, dto.role as ApiKeyRole));
  }

  @Delete(':keyId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(@Param('tenantId') tenantId: string, @Param('keyId') keyId: string, @Req() req: FastifyRequest) {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId || userTenantId !== tenantId) throw new ForbiddenException('Tenant mismatch');

    ResultUtils.unwrapOrThrow(await this.apiKeyService.revoke(keyId));
  }
}
