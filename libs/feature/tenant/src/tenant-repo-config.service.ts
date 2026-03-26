import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result, err } from 'neverthrow';
import { ResultUtils, PinoLoggerService, sanitizeRecord, sanitizeLog } from '@app/common';
import type { AppError } from '@app/common';
import { TenantRepoConfig, Tenant, AgentProvider, CloneStrategy } from '@app/db';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, IsInt, Min, Max, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateRepoConfigDto {
  @IsString()
  @MaxLength(255)
  repoId!: string;

  @IsString()
  @MaxLength(2048)
  repoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  setupCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  testCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lintCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  typecheckCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  buildCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentTemplateId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConcurrentWorkflows?: number;

  @IsOptional()
  @IsEnum(AgentProvider)
  agentProvider?: AgentProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentModel?: string;

  @IsOptional()
  @IsObject()
  modelRouting?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  costLimitUsd?: number;

  @IsOptional()
  @IsObject()
  costTiers?: Record<string, number>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxDiffLines?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  allowedPaths?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commitMessagePattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  mrDescriptionTemplate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  qualityGateCommands?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staticAnalysisCommand?: string;

  @IsOptional()
  @IsEnum(CloneStrategy)
  cloneStrategy?: CloneStrategy;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sparseCheckoutPaths?: string[];
}

export class UpdateRepoConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  repoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  repoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  setupCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  testCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lintCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  typecheckCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  buildCommand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentTemplateId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConcurrentWorkflows?: number;

  @IsOptional()
  @IsEnum(AgentProvider)
  agentProvider?: AgentProvider;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentModel?: string;

  @IsOptional()
  @IsObject()
  modelRouting?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  costLimitUsd?: number;

  @IsOptional()
  @IsObject()
  costTiers?: Record<string, number>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxDiffLines?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  allowedPaths?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commitMessagePattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  mrDescriptionTemplate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  qualityGateCommands?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staticAnalysisCommand?: string;

  @IsOptional()
  @IsEnum(CloneStrategy)
  cloneStrategy?: CloneStrategy;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sparseCheckoutPaths?: string[];
}

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
    this.logger.log(`Repo config created: ${sanitizeLog(dto.repoId)} for tenant ${sanitizeLog(tenantId)}`);
    return ResultUtils.ok(config);
  }

  async list(tenantId: string): Promise<Result<TenantRepoConfig[], AppError>> {
    const configs = await this.em.find(TenantRepoConfig, { tenant: tenantId }, { limit: 200 });
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
    if (findResult.isErr()) return err(findResult.error);
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }

  private applyDto(config: TenantRepoConfig, dto: UpdateRepoConfigDto): void {
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
    if (dto.modelRouting !== undefined) config.modelRouting = sanitizeRecord(dto.modelRouting) as Record<string, string>;
    if (dto.costLimitUsd !== undefined) config.costLimitUsd = dto.costLimitUsd;
    if (dto.costTiers !== undefined) config.costTiers = sanitizeRecord(dto.costTiers) as Record<string, number>;
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
