import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { TenantRepoConfig, Tenant, AgentProvider, CloneStrategy } from '@ai-sdlc/db';

export interface CreateRepoConfigDto {
  repoId: string;
  repoUrl: string;
  branchPrefix?: string;
  setupCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  typecheckCommand?: string;
  buildCommand?: string;
  agentTemplateId?: string;
  maxConcurrentWorkflows?: number;
  agentProvider?: AgentProvider;
  agentModel?: string;
  modelRouting?: Record<string, string>;
  costLimitUsd?: number;
  costTiers?: Record<string, number>;
  maxDiffLines?: number;
  allowedPaths?: string[];
  commitMessagePattern?: string;
  mrDescriptionTemplate?: string;
  qualityGateCommands?: string[];
  staticAnalysisCommand?: string;
  cloneStrategy?: CloneStrategy;
  sparseCheckoutPaths?: string[];
}

export interface UpdateRepoConfigDto extends Partial<CreateRepoConfigDto> {}

@Injectable()
export class TenantRepoConfigService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('TenantRepoConfigService');
  }

  async create(tenantId: string, dto: CreateRepoConfigDto): Promise<Result<TenantRepoConfig, AppError>> {
    const existing = await this.em.findOne(TenantRepoConfig, { tenant: tenantId, repoId: dto.repoId });
    if (existing) return ResultUtils.err('CONFLICT', `Repo config for '${dto.repoId}' already exists`);

    const config = new TenantRepoConfig();
    config.tenant = this.em.getReference(Tenant, tenantId);
    this.applyDto(config, dto);

    await this.em.persistAndFlush(config);
    this.logger.log(`Repo config created: ${dto.repoId} for tenant ${tenantId}`);
    return ResultUtils.ok(config);
  }

  async list(tenantId: string): Promise<Result<TenantRepoConfig[], AppError>> {
    const configs = await this.em.find(TenantRepoConfig, { tenant: tenantId });
    return ResultUtils.ok(configs);
  }

  async findById(tenantId: string, id: string): Promise<Result<TenantRepoConfig, AppError>> {
    const config = await this.em.findOne(TenantRepoConfig, { id, tenant: tenantId });
    if (!config) return ResultUtils.err('NOT_FOUND', `Repo config ${id} not found`);
    return ResultUtils.ok(config);
  }

  async findByRepoId(tenantId: string, repoId: string): Promise<Result<TenantRepoConfig, AppError>> {
    const config = await this.em.findOne(TenantRepoConfig, { tenant: tenantId, repoId });
    if (!config) return ResultUtils.err('NOT_FOUND', `Repo config for '${repoId}' not found`);
    return ResultUtils.ok(config);
  }

  async update(tenantId: string, id: string, dto: UpdateRepoConfigDto): Promise<Result<TenantRepoConfig, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult;

    this.applyDto(findResult.value, dto);
    await this.em.flush();
    return ResultUtils.ok(findResult.value);
  }

  async delete(tenantId: string, id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult as unknown as Result<void, AppError>;
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }

  private applyDto(config: TenantRepoConfig, dto: Partial<CreateRepoConfigDto>): void {
    if (dto.repoId !== undefined) config.repoId = dto.repoId;
    if (dto.repoUrl !== undefined) config.repoUrl = dto.repoUrl;
    if (dto.branchPrefix !== undefined) config.branchPrefix = dto.branchPrefix;
    if (dto.setupCommand !== undefined) config.setupCommand = dto.setupCommand;
    if (dto.testCommand !== undefined) config.testCommand = dto.testCommand;
    if (dto.lintCommand !== undefined) config.lintCommand = dto.lintCommand;
    if (dto.typecheckCommand !== undefined) config.typecheckCommand = dto.typecheckCommand;
    if (dto.buildCommand !== undefined) config.buildCommand = dto.buildCommand;
    if (dto.agentTemplateId !== undefined) config.agentTemplateId = dto.agentTemplateId;
    if (dto.maxConcurrentWorkflows !== undefined) config.maxConcurrentWorkflows = dto.maxConcurrentWorkflows;
    if (dto.agentProvider !== undefined) config.agentProvider = dto.agentProvider;
    if (dto.agentModel !== undefined) config.agentModel = dto.agentModel;
    if (dto.modelRouting !== undefined) config.modelRouting = dto.modelRouting;
    if (dto.costLimitUsd !== undefined) config.costLimitUsd = dto.costLimitUsd;
    if (dto.costTiers !== undefined) config.costTiers = dto.costTiers;
    if (dto.maxDiffLines !== undefined) config.maxDiffLines = dto.maxDiffLines;
    if (dto.allowedPaths !== undefined) config.allowedPaths = dto.allowedPaths;
    if (dto.commitMessagePattern !== undefined) config.commitMessagePattern = dto.commitMessagePattern;
    if (dto.mrDescriptionTemplate !== undefined) config.mrDescriptionTemplate = dto.mrDescriptionTemplate;
    if (dto.qualityGateCommands !== undefined) config.qualityGateCommands = dto.qualityGateCommands;
    if (dto.staticAnalysisCommand !== undefined) config.staticAnalysisCommand = dto.staticAnalysisCommand;
    if (dto.cloneStrategy !== undefined) config.cloneStrategy = dto.cloneStrategy;
    if (dto.sparseCheckoutPaths !== undefined) config.sparseCheckoutPaths = dto.sparseCheckoutPaths;
  }
}
