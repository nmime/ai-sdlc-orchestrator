import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { Tenant, TenantStatus, TenantUser, TenantRole, TenantApiKey, TenantRepoConfig, TenantMcpServer, TenantVcsCredential, TenantWebhookConfig, WorkflowMirror, WorkflowEvent, WorkflowArtifact, AgentSession, AgentToolCall, CostAlert, PollingSchedule, WebhookDelivery, WorkflowDsl } from '@ai-sdlc/db';
import type { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
export { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

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
    if (findResult.isErr()) return findResult as unknown as Result<void, AppError>;

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
    const users = await this.em.find(TenantUser, { tenant: tenantId });
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

  async purgeData(id: string): Promise<Result<{ deletedCounts: Record<string, number> }, AppError>> {
    const findResult = await this.findById(id);
    if (findResult.isErr()) return findResult as unknown as Result<{ deletedCounts: Record<string, number> }, AppError>;

    const counts: Record<string, number> = {};

    const workflows = await this.em.find(WorkflowMirror, { tenant: id });
    const workflowIds = workflows.map(w => w.id);

    if (workflowIds.length > 0) {
      const sessions = await this.em.find(AgentSession, { workflow: { $in: workflowIds } });
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length > 0) {
        counts['agentToolCalls'] = await this.em.nativeDelete(AgentToolCall, { session: { $in: sessionIds } });
      }
      counts['agentSessions'] = await this.em.nativeDelete(AgentSession, { workflow: { $in: workflowIds } });
      counts['workflowEvents'] = await this.em.nativeDelete(WorkflowEvent, { workflow: { $in: workflowIds } });
      counts['workflowArtifacts'] = await this.em.nativeDelete(WorkflowArtifact, { workflow: { $in: workflowIds } });
    }
    counts['workflowMirrors'] = await this.em.nativeDelete(WorkflowMirror, { tenant: id });
    counts['workflowDsls'] = await this.em.nativeDelete(WorkflowDsl, { tenant: id });
    counts['costAlerts'] = await this.em.nativeDelete(CostAlert, { tenant: id });
    counts['webhookDeliveries'] = await this.em.nativeDelete(WebhookDelivery, { tenant: id });
    counts['pollingSchedules'] = await this.em.nativeDelete(PollingSchedule, { tenant: id });
    counts['tenantWebhookConfigs'] = await this.em.nativeDelete(TenantWebhookConfig, { tenant: id });
    counts['tenantVcsCredentials'] = await this.em.nativeDelete(TenantVcsCredential, { tenant: id });
    counts['tenantMcpServers'] = await this.em.nativeDelete(TenantMcpServer, { tenant: id });
    counts['tenantRepoConfigs'] = await this.em.nativeDelete(TenantRepoConfig, { tenant: id });
    counts['tenantApiKeys'] = await this.em.nativeDelete(TenantApiKey, { tenant: id });
    counts['tenantUsers'] = await this.em.nativeDelete(TenantUser, { tenant: id });
    counts['tenant'] = await this.em.nativeDelete(Tenant, { id });

    this.logger.log(`Tenant data purged: ${id}`);
    return ResultUtils.ok({ deletedCounts: counts });
  }

  async exportData(id: string): Promise<Result<Record<string, unknown>, AppError>> {
    const findResult = await this.findById(id);
    if (findResult.isErr()) return findResult as unknown as Result<Record<string, unknown>, AppError>;

    const tenant = findResult.value;
    const users = await this.em.find(TenantUser, { tenant: id });
    const workflows = await this.em.find(WorkflowMirror, { tenant: id });
    const alerts = await this.em.find(CostAlert, { tenant: id });

    return ResultUtils.ok({
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, createdAt: tenant.createdAt },
      users: users.map(u => ({ id: u.id, email: u.email, role: u.role, provider: u.provider, createdAt: u.createdAt })),
      workflows: workflows.map(w => ({ id: w.id, state: w.state, repoUrl: w.repoUrl, createdAt: w.createdAt })),
      costAlerts: alerts.map(a => ({ id: a.id, alertType: a.alertType, actualUsd: a.actualUsd, createdAt: a.createdAt })),
    });
  }
}
