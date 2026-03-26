import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
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
  ttlSeconds?: number;
}

export class ResolveHostDto {
  @IsString()
  @MaxLength(500)
  host!: string;
}

export class RecordCostDto {
  inputTokens!: number;
  outputTokens!: number;

  @IsString()
  @MaxLength(100)
  provider!: string;

  @IsString()
  @MaxLength(100)
  model!: string;
}
