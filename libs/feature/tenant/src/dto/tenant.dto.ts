import { IsString, IsOptional, IsNumber, IsInt, Min, Max, MaxLength, MinLength, IsObject, IsEnum } from 'class-validator';
import { TenantStatus } from '@ai-sdlc/db';

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
  @MinLength(1)
  @MaxLength(255)
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
  @MaxLength(100)
  defaultAgentProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultAgentModel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentWorkflows?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentSandboxes?: number;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
