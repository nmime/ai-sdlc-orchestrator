import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { TenantVcsCredential, Tenant, VcsProvider } from '@ai-sdlc/db';

export interface CreateVcsCredentialDto {
  provider: VcsProvider;
  host: string;
  secretRef: string;
}

export interface UpdateVcsCredentialDto {
  host?: string;
  secretRef?: string;
}

@Injectable()
export class TenantVcsCredentialService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('TenantVcsCredentialService');
  }

  async create(tenantId: string, dto: CreateVcsCredentialDto): Promise<Result<TenantVcsCredential, AppError>> {
    const cred = new TenantVcsCredential();
    cred.tenant = this.em.getReference(Tenant, tenantId);
    cred.provider = dto.provider;
    cred.host = dto.host;
    cred.secretRef = dto.secretRef;

    await this.em.persistAndFlush(cred);
    this.logger.log(`VCS credential created for ${dto.provider}/${dto.host} tenant ${tenantId}`);
    return ResultUtils.ok(cred);
  }

  async list(tenantId: string): Promise<Result<TenantVcsCredential[], AppError>> {
    const creds = await this.em.find(TenantVcsCredential, { tenant: tenantId });
    return ResultUtils.ok(creds);
  }

  async findById(tenantId: string, id: string): Promise<Result<TenantVcsCredential, AppError>> {
    const cred = await this.em.findOne(TenantVcsCredential, { id, tenant: tenantId });
    if (!cred) return ResultUtils.err('NOT_FOUND', `VCS credential ${id} not found`);
    return ResultUtils.ok(cred);
  }

  async update(tenantId: string, id: string, dto: UpdateVcsCredentialDto): Promise<Result<TenantVcsCredential, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult;

    const cred = findResult.value;
    if (dto.host !== undefined) cred.host = dto.host;
    if (dto.secretRef !== undefined) cred.secretRef = dto.secretRef;

    await this.em.flush();
    return ResultUtils.ok(cred);
  }

  async delete(tenantId: string, id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult as unknown as Result<void, AppError>;
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }
}
