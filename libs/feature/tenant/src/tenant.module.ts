import { Global, Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { ApiKeyService } from './api-key.service';
import { TenantMcpServerService } from './tenant-mcp-server.service';
import { TenantVcsCredentialService } from './tenant-vcs-credential.service';
import { TenantRepoConfigService } from './tenant-repo-config.service';
import { TenantWebhookConfigService } from './tenant-webhook-config.service';
import {
  TenantMcpServerController,
  TenantVcsCredentialController,
  TenantRepoConfigController,
  TenantWebhookConfigController,
} from './tenant-resource.controllers';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { ApiKeyController } from './api-key.controller';
import { UserController } from './user.controller';
import { DslController } from './dsl.controller';
import { PollingScheduleController } from './polling-schedule.controller';

@Global()
@Module({
  controllers: [
    TenantController,
    TenantMcpServerController,
    TenantVcsCredentialController,
    TenantRepoConfigController,
    TenantWebhookConfigController,
    ApiKeyController,
    UserController,
    DslController,
    PollingScheduleController,
  ],
  providers: [
    TenantService,
    ApiKeyService,
    TenantMcpServerService,
    TenantVcsCredentialService,
    TenantRepoConfigService,
    TenantWebhookConfigService,
    AuthGuard,
    RbacGuard,
  ],
  exports: [
    TenantService,
    ApiKeyService,
    TenantMcpServerService,
    TenantVcsCredentialService,
    TenantRepoConfigService,
    TenantWebhookConfigService,
    AuthGuard,
    RbacGuard,
  ],
})
export class TenantModule {}
