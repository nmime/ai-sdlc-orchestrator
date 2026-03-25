import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@app/common';
import type { AppError, AppConfig } from '@app/common';
import type { AiAgentPort } from '@app/feature-agent-registry';
import type { AgentInvokeInput, AgentInvokeOutput } from '@app/shared-type';

@Injectable()
export class ClaudeAgentAdapter implements AiAgentPort {
  readonly name = 'claude_code';
  private client: Anthropic;
  private activeSessions = new Map<string, AbortController>();

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('ClaudeAgentAdapter');
    this.client = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }

  async invoke(input: AgentInvokeInput): Promise<Result<AgentInvokeOutput, AppError>> {
    const abortController = new AbortController();
    this.activeSessions.set(input.sessionId, abortController);

    try {
      this.logger.log(`Invoking Claude agent for session ${input.sessionId}`);

      const startTime = Date.now();
      let inputTokens = 0;
      let outputTokens = 0;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        system: input.prompt,
        messages: [
          {
            role: 'user',
            content: 'Execute the task described in the system prompt. Use the available tools to complete it.',
          },
        ],
      });

      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      const aiCostUsd = this.calculateCost(inputTokens, outputTokens);
      const durationMs = Date.now() - startTime;

      this.logger.log(`Session ${input.sessionId} completed in ${durationMs}ms, cost: $${aiCostUsd.toFixed(4)}`);

      return ResultUtils.ok({
        success: true,
        filesChanged: 0,
        inputTokens,
        outputTokens,
        aiCostUsd,
        sandboxCostUsd: 0,
        artifacts: [],
      });
    } catch (error) {
      this.logger.error(`Session ${input.sessionId} failed: ${(error as Error).message}`);
      return ResultUtils.err('AGENT_ERROR', (error as Error).message);
    } finally {
      this.activeSessions.delete(input.sessionId);
    }
  }

  async cancel(sessionId: string): Promise<Result<void, AppError>> {
    const controller = this.activeSessions.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeSessions.delete(sessionId);
      return ResultUtils.ok(undefined);
    }
    return ResultUtils.err('NOT_FOUND', `Session ${sessionId} not found`);
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCostPer1M = 3.0;
    const outputCostPer1M = 15.0;
    return (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1_000_000;
  }
}
