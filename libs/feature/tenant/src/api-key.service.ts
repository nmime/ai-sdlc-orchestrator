import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { TenantApiKey, Tenant, ApiKeyRole } from '@ai-sdlc/db';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('ApiKeyService');
  }

  async generate(tenantId: string, name: string, role: ApiKeyRole = ApiKeyRole.VIEWER): Promise<Result<{ key: string; id: string }, AppError>> {
    const rawKey = `asdlc_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = new TenantApiKey();
    apiKey.tenant = this.em.getReference(Tenant, tenantId);
    apiKey.keyHash = keyHash;
    apiKey.name = name;
    apiKey.role = role;

    await this.em.persistAndFlush(apiKey);

    return ResultUtils.ok({ key: rawKey, id: apiKey.id });
  }

  async validate(rawKey: string): Promise<Result<TenantApiKey, AppError>> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.em.findOne(TenantApiKey, { keyHash }, { populate: ['tenant'] });

    if (!apiKey) {
      return ResultUtils.err('UNAUTHORIZED', 'Invalid API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return ResultUtils.err('UNAUTHORIZED', 'API key expired');
    }

    return ResultUtils.ok(apiKey);
  }

  async revoke(keyId: string): Promise<Result<void, AppError>> {
    const deleted = await this.em.nativeDelete(TenantApiKey, { id: keyId });
    if (deleted === 0) return ResultUtils.err('NOT_FOUND', 'API key not found');
    return ResultUtils.ok(undefined);
  }
}
