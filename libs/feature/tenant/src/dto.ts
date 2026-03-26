import { IsString, IsOptional, IsNumber, IsObject, MinLength, Min, IsIn, MaxLength, Max } from 'class-validator';
import type { TenantStatus } from '@app/db';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  monthlyCostLimitUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultAgentProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultAgentModel?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  monthlyCostLimitUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  monthlyAiCostLimitUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  monthlySandboxCostLimitUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultAgentProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultAgentModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxConcurrentWorkflows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxConcurrentSandboxes?: number;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['active', 'suspended', 'deleted'])
  status?: TenantStatus;
}

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: string;
}

export class GateDecisionDto {
  @IsIn(['approve', 'request_changes', 'reject'])
  action!: string;

  @IsString()
  @MaxLength(255)
  reviewer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class GateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class GateRequireCommentDto {
  @IsString()
  @MaxLength(5000)
  comment!: string;
}

export class CancelWorkflowDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
