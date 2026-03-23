import { Result } from 'neverthrow';
import type { AppError } from '@ai-sdlc/common';
import type { AgentInvokeInput, AgentInvokeOutput } from '@ai-sdlc/shared-type';

export interface AiAgentPort {
  readonly name: string;
  invoke(input: AgentInvokeInput): Promise<Result<AgentInvokeOutput, AppError>>;
  cancel(sessionId: string): Promise<Result<void, AppError>>;
}
