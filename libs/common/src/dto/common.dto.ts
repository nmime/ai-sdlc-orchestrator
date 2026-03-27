import { IsString, IsOptional, MaxLength, Matches, IsInt, Min, Max } from 'class-validator';
import type { GateAction } from '@ai-sdlc/shared-type';

export class GateDecideDto {
  @IsString()
  @MaxLength(50)
  action!: GateAction;

  @IsString()
  @MaxLength(255)
  reviewer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class GateCancelDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class WorkflowRetryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromStep?: string;
}

export class CreateSessionDto {
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @IsString()
  @MaxLength(255)
  workflowId!: string;

  @IsString()
  @MaxLength(255)
  sessionId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  ttlSeconds?: number;
}

export class ResolveHostDto {
  @IsString()
  @MaxLength(500)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/, { message: 'host must be a valid hostname' })
  host!: string;
}

export class RecordCostDto {
  @IsInt()
  @Min(0)
  inputTokens!: number;

  @IsInt()
  @Min(0)
  outputTokens!: number;

  @IsString()
  @MaxLength(100)
  provider!: string;

  @IsString()
  @MaxLength(100)
  model!: string;
}
