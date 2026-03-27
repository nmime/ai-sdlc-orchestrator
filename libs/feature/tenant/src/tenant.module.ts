import { Module } from '@nestjs/common';
import { LoggerModule } from '@ai-sdlc/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { ApiKeyService } from './api-key.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [LoggerModule],
  controllers: [TenantController],
  providers: [TenantService, ApiKeyService, AuthGuard, RbacGuard],
  exports: [TenantService, ApiKeyService, AuthGuard, RbacGuard],
})
export class TenantModule {}
