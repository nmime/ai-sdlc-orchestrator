import { Injectable } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import { type Result, err } from 'neverthrow';
import { ResultUtils, type PinoLoggerService } from '@app/common';
import type { AppError } from '@app/common';
import { TenantWebhookConfig, Tenant, WebhookPlatform, WebhookConfigStatus } from '@app/db';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class CreateWebhookConfigDto {
  @IsEnum(WebhookPlatform)
  platform!: WebhookPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  secretRef?: string;
}

export class UpdateWebhookConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webhookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webhookUrl?: string;

  @IsOptional()
  @IsEnum(WebhookConfigStatus)
  status?: WebhookConfigStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  secretRef?: string;
}

@Injectable()
export class TenantWebhookConfigService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('TenantWebhookConfigService');
  }

  async create(tenantId: string, dto: CreateWebhookConfigDto): Promise<Result<TenantWebhookConfig, AppError>> {
    const config = new TenantWebhookConfig();
    config.tenant = this.em.getReference(Tenant, tenantId);
    config.platform = dto.platform;
    if (dto.webhookId !== undefined) config.webhookId = dto.webhookId;
    if (dto.webhookUrl !== undefined) config.webhookUrl = dto.webhookUrl;
    if (dto.secretRef !== undefined) config.secretRef = dto.secretRef;

    await this.em.persistAndFlush(config);
    this.logger.log(`Webhook config created for ${dto.platform} tenant ${tenantId}`);
    return ResultUtils.ok(config);
  }

  async list(tenantId: string): Promise<Result<TenantWebhookConfig[], AppError>> {
    const configs = await this.em.find(TenantWebhookConfig, { tenant: tenantId }, { limit: 200 });
    return ResultUtils.ok(configs);
  }

  async findById(tenantId: string, id: string): Promise<Result<TenantWebhookConfig, AppError>> {
    const config = await this.em.findOne(TenantWebhookConfig, { id, tenant: tenantId });
    if (!config) return ResultUtils.err('NOT_FOUND', `Webhook config ${id} not found`);
    return ResultUtils.ok(config);
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookConfigDto): Promise<Result<TenantWebhookConfig, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult;

    const config = findResult.value;
    if (dto.webhookId !== undefined) config.webhookId = dto.webhookId;
    if (dto.webhookUrl !== undefined) config.webhookUrl = dto.webhookUrl;
    if (dto.status !== undefined) config.status = dto.status;
    if (dto.secretRef !== undefined) config.secretRef = dto.secretRef;

    await this.em.flush();
    return ResultUtils.ok(config);
  }

  async delete(tenantId: string, id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return err(findResult.error);
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }
}
