import { IsString, IsOptional, IsNumber, IsObject, MinLength, Min, IsIn } from 'class-validator';
import type { TenantStatus } from '@app/db';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  slug!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCostLimitUsd?: number;

  @IsOptional()
  @IsString()
  defaultAgentProvider?: string;

  @IsOptional()
  @IsString()
  defaultAgentModel?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCostLimitUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyAiCostLimitUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySandboxCostLimitUsd?: number;

  @IsOptional()
  @IsString()
  defaultAgentProvider?: string;

  @IsOptional()
  @IsString()
  defaultAgentModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConcurrentWorkflows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
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
  name!: string;

  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: string;
}

export class GateDecisionDto {
  @IsIn(['approve', 'request_changes', 'reject'])
  action!: string;

  @IsString()
  reviewer!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class GateCommentDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class GateRequireCommentDto {
  @IsString()
  comment!: string;
}

export class CancelWorkflowDto {
  @IsString()
  reason!: string;
}
