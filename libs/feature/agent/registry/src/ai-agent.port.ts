import type { Result } from 'neverthrow';
import type { AppError } from '@app/common';
import type { AgentInvokeInput, AgentInvokeOutput } from '@app/shared-type';

export interface AiAgentPort {
  readonly name: string;
  invoke(input: AgentInvokeInput): Promise<Result<AgentInvokeOutput, AppError>>;
  cancel(sessionId: string): Promise<Result<void, AppError>>;
}
