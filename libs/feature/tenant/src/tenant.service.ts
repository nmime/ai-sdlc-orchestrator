import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result, err } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@app/common';
import type { AppError } from '@app/common';
import { Tenant, TenantStatus, TenantUser, TenantRole } from '@app/db';
import { CreateTenantDto, UpdateTenantDto } from './dto';
export { CreateTenantDto, UpdateTenantDto } from './dto';

@Injectable()
export class TenantService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('TenantService');
  }

  async create(dto: CreateTenantDto): Promise<Result<Tenant, AppError>> {
    const existing = await this.em.findOne(Tenant, { slug: dto.slug });
    if (existing) {
      return ResultUtils.err('CONFLICT', `Tenant with slug '${dto.slug}' already exists`);
    }

    const tenant = new Tenant();
    tenant.slug = dto.slug;
    tenant.name = dto.name;
    if (dto.monthlyCostLimitUsd !== undefined) tenant.monthlyCostLimitUsd = dto.monthlyCostLimitUsd;
    if (dto.defaultAgentProvider) tenant.defaultAgentProvider = dto.defaultAgentProvider;
    if (dto.defaultAgentModel) tenant.defaultAgentModel = dto.defaultAgentModel;
    if (dto.meta) tenant.meta = dto.meta;

    await this.em.persistAndFlush(tenant);
    this.logger.log(`Tenant created: ${tenant.slug}`);
    return ResultUtils.ok(tenant);
  }

  async findById(id: string): Promise<Result<Tenant, AppError>> {
    const tenant = await this.em.findOne(Tenant, { id });
    if (!tenant) return ResultUtils.err('NOT_FOUND', `Tenant ${id} not found`);
    return ResultUtils.ok(tenant);
  }

  async findBySlug(slug: string): Promise<Result<Tenant, AppError>> {
    const tenant = await this.em.findOne(Tenant, { slug });
    if (!tenant) return ResultUtils.err('NOT_FOUND', `Tenant '${slug}' not found`);
    return ResultUtils.ok(tenant);
  }

  async list(): Promise<Result<Tenant[], AppError>> {
    const tenants = await this.em.find(Tenant, { status: { $ne: TenantStatus.DELETED } });
    return ResultUtils.ok(tenants);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Result<Tenant, AppError>> {
    const findResult = await this.findById(id);
    if (findResult.isErr()) return findResult;

    const tenant = findResult.value;
    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.monthlyCostLimitUsd !== undefined) tenant.monthlyCostLimitUsd = dto.monthlyCostLimitUsd;
    if (dto.monthlyAiCostLimitUsd !== undefined) tenant.monthlyAiCostLimitUsd = dto.monthlyAiCostLimitUsd;
    if (dto.monthlySandboxCostLimitUsd !== undefined) tenant.monthlySandboxCostLimitUsd = dto.monthlySandboxCostLimitUsd;
    if (dto.defaultAgentProvider !== undefined) tenant.defaultAgentProvider = dto.defaultAgentProvider;
    if (dto.defaultAgentModel !== undefined) tenant.defaultAgentModel = dto.defaultAgentModel;
    if (dto.maxConcurrentWorkflows !== undefined) tenant.maxConcurrentWorkflows = dto.maxConcurrentWorkflows;
    if (dto.maxConcurrentSandboxes !== undefined) tenant.maxConcurrentSandboxes = dto.maxConcurrentSandboxes;
    if (dto.meta !== undefined) tenant.meta = dto.meta;
    if (dto.status !== undefined) tenant.status = dto.status;

    await this.em.flush();
    return ResultUtils.ok(tenant);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(id);
    if (findResult.isErr()) return err(findResult.error);

    findResult.value.status = TenantStatus.DELETED;
    await this.em.flush();
    return ResultUtils.ok(undefined);
  }

  async addUser(tenantId: string, externalId: string, provider: string, email: string, role: TenantRole): Promise<Result<TenantUser, AppError>> {
    const user = new TenantUser();
    user.tenant = this.em.getReference(Tenant, tenantId);
    user.externalId = externalId;
    user.provider = provider;
    user.email = email;
    user.role = role;

    await this.em.persistAndFlush(user);
    return ResultUtils.ok(user);
  }

  async getUsers(tenantId: string): Promise<Result<TenantUser[], AppError>> {
    const users = await this.em.find(TenantUser, { tenant: tenantId }, { limit: 200 });
    return ResultUtils.ok(users);
  }

  async reserveBudget(tenantId: string, estimatedCostUsd: number): Promise<Result<{ budgetVersion: number }, AppError>> {
    const tenant = await this.em.findOne(Tenant, { id: tenantId });
    if (!tenant) return ResultUtils.err('NOT_FOUND', 'Tenant not found');

    const total = Number(tenant.monthlyCostActualUsd) + Number(tenant.monthlyCostReservedUsd) + estimatedCostUsd;
    if (Number(tenant.monthlyCostLimitUsd) > 0 && total > Number(tenant.monthlyCostLimitUsd)) {
      return ResultUtils.err('BUDGET_EXCEEDED', `Budget would exceed limit: $${total.toFixed(2)} > $${tenant.monthlyCostLimitUsd}`);
    }

    const currentVersion = tenant.budgetVersion;
    const updated = await this.em.nativeUpdate(
      Tenant,
      { id: tenantId, budgetVersion: currentVersion },
      {
        monthlyCostReservedUsd: Number(tenant.monthlyCostReservedUsd) + estimatedCostUsd,
        budgetVersion: currentVersion + 1,
      },
    );

    if (updated === 0) {
      return ResultUtils.err('CONFLICT', 'Budget was concurrently modified, retry');
    }

    return ResultUtils.ok({ budgetVersion: currentVersion + 1 });
  }
}
