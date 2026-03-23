import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { TenantApiKey, Tenant } from '@ai-sdlc/db';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('ApiKeyService');
  }

  async generate(tenantId: string, label: string, scopes?: string[]): Promise<Result<{ key: string; keyPrefix: string }, AppError>> {
    const rawKey = `asdlc_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = new TenantApiKey();
    apiKey.tenant = this.em.getReference(Tenant, tenantId);
    apiKey.label = label;
    apiKey.keyHash = keyHash;
    apiKey.keyPrefix = keyPrefix;
    apiKey.scopes = scopes;

    await this.em.persistAndFlush(apiKey);

    return ResultUtils.ok({ key: rawKey, keyPrefix });
  }

  async validate(rawKey: string): Promise<Result<TenantApiKey, AppError>> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.em.findOne(TenantApiKey, { keyHash, active: true }, { populate: ['tenant'] });

    if (!apiKey) {
      return ResultUtils.err('UNAUTHORIZED', 'Invalid API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return ResultUtils.err('UNAUTHORIZED', 'API key expired');
    }

    apiKey.lastUsedAt = new Date();
    await this.em.flush();

    return ResultUtils.ok(apiKey);
  }

  async revoke(keyId: string): Promise<Result<void, AppError>> {
    const apiKey = await this.em.findOne(TenantApiKey, { id: keyId });
    if (!apiKey) return ResultUtils.err('NOT_FOUND', 'API key not found');

    apiKey.active = false;
    await this.em.flush();
    return ResultUtils.ok(undefined);
  }
}
