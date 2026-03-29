import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Result } from 'neverthrow';
import type { LanguageModel } from 'ai';
import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createXai } from '@ai-sdk/xai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { ResultUtils, type PinoLoggerService, sanitizeLog } from '@app/common';
import type { AppError, AppConfig } from '@app/common';
import type { AiAgentPort } from '@app/feature-agent-registry';
import type { AgentInvokeInput, AgentInvokeOutput, PublishedArtifact } from '@app/shared-type';
import { createSandboxTools, calculateAiCost, calculateSandboxCost } from '@app/feature-agent-shared-tools';
import type { SandboxToolContext } from '@app/feature-agent-shared-tools';

export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'mistral'
  | 'xai'
  | 'azure'
  | 'bedrock'
  | 'openai-compatible';

const DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro-latest',
  mistral: 'mistral-large-latest',
  xai: 'grok-3',
  azure: 'gpt-4o',
  bedrock: 'anthropic.claude-sonnet-4-20250514-v1:0',
  'openai-compatible': 'default',
};

export interface UnifiedAdapterOpts {
  name?: string;
  providerType?: ProviderType;
  model?: string;
  apiKey?: string;
  baseURL?: string;
}

@Injectable()
export class UnifiedAgentAdapter implements AiAgentPort {
  readonly name: string;
  private readonly activeSessions = new Map<string, AbortController>();
  private readonly providerType: ProviderType;
  private readonly model: string;
  private readonly languageModel: LanguageModel;

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly logger: PinoLoggerService,
    opts?: UnifiedAdapterOpts,
  ) {
    this.providerType = opts?.providerType ?? this.detectProvider();
    this.model = opts?.model ?? configService.get('DEFAULT_AGENT_MODEL', { infer: true }) ?? DEFAULT_MODELS[this.providerType];
    this.name = opts?.name ?? this.providerType;
    this.languageModel = this.createModel(opts);
    this.logger.setContext(`UnifiedAgent[${this.name}/${this.model}]`);
  }

  async invoke(input: AgentInvokeInput): Promise<Result<AgentInvokeOutput, AppError>> {
    const abortController = new AbortController();
    this.activeSessions.set(input.sessionId, abortController);

    const durationTimeout = input.maxDurationMs
      ? setTimeout(() => abortController.abort(), input.maxDurationMs)
      : undefined;

    try {
      this.logger.log(`Starting session ${sanitizeLog(input.sessionId)}`);
      const startTime = Date.now();
      let filesChanged = 0;
      let runningCostUsd = 0;

      const ctx: SandboxToolContext = {
        sandboxId: input.sandboxId,
        credentialProxyUrl: input.credentialProxyUrl,
        onFileWrite: () => { filesChanged++; },
      };

      const maxSteps = this.configService.get('AGENT_MAX_TURNS', { infer: true }) ?? 25;

      const costConfig = {
        inputCostPer1M: this.configService.get('AI_INPUT_COST_PER_1M', { infer: true }) ?? 3.0,
        outputCostPer1M: this.configService.get('AI_OUTPUT_COST_PER_1M', { infer: true }) ?? 15.0,
        sandboxCostPerHourUsd: this.configService.get('SANDBOX_COST_PER_HOUR_USD', { infer: true }) ?? 0.05,
      };

      const result = await generateText({
        model: this.languageModel,
        system: input.prompt,
        prompt: 'Execute the task described in the system prompt. Clone the repo, create a branch, implement the changes, run tests, commit, and push. Report what you did.',
        tools: createSandboxTools(ctx) as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- zodSchema() tools are ToolSet-compatible at runtime; TS overload mismatch under commonjs
        stopWhen: stepCountIs(maxSteps),
        abortSignal: abortController.signal,
        maxOutputTokens: 16384,
        providerOptions: this.buildProviderOptions() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- SharedV3ProviderOptions requires JSONObject; anthropic options are runtime-valid
        onStepFinish: ({ stepNumber, usage }) => {
          const stepCost = calculateAiCost(usage.inputTokens ?? 0, usage.outputTokens ?? 0, costConfig);
          runningCostUsd += stepCost;
          this.logger.log(
            `Step ${stepNumber}: +${usage.inputTokens ?? 0}in/${usage.outputTokens ?? 0}out tokens ($${runningCostUsd.toFixed(4)} total)`,
          );
          if (input.maxCostUsd && runningCostUsd >= input.maxCostUsd) {
            this.logger.warn(`Cost limit reached ($${runningCostUsd.toFixed(4)} >= $${input.maxCostUsd}), aborting`);
            abortController.abort();
          }
        },
      });

      const totalInputTokens = result.usage.inputTokens ?? 0;
      const totalOutputTokens = result.usage.outputTokens ?? 0;

      const aiCostUsd = calculateAiCost(totalInputTokens, totalOutputTokens, costConfig);
      const durationMs = Date.now() - startTime;
      const sandboxCostUsd = calculateSandboxCost(durationMs, costConfig.sandboxCostPerHourUsd);
      const artifacts: PublishedArtifact[] = [];

      this.logger.log(
        `Session done: ${result.steps.length} steps, ${durationMs}ms, $${aiCostUsd.toFixed(4)} AI + $${sandboxCostUsd.toFixed(4)} sandbox`,
      );

      return ResultUtils.ok({
        success: true,
        filesChanged,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        aiCostUsd,
        sandboxCostUsd,
        artifacts,
      });
    } catch (error) {
      this.logger.error(`Session failed: ${sanitizeLog((error as Error).message)}`);
      return ResultUtils.err('AGENT_ERROR', (error as Error).message);
    } finally {
      if (durationTimeout) clearTimeout(durationTimeout);
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

  private buildProviderOptions(): Record<string, Record<string, unknown>> | undefined {
    if (this.providerType === 'anthropic' || this.providerType === 'bedrock') {
      return {
        anthropic: {
          thinking: { type: 'adaptive' as const },
          sendReasoning: true,
        },
      } as Record<string, Record<string, unknown>>;
    }
    return undefined;
  }

  private detectProvider(): ProviderType {
    const explicit = this.configService.get('DEFAULT_AGENT_PROVIDER', { infer: true });
    if (explicit && explicit !== 'auto') return explicit as ProviderType;

    if (this.configService.get('ANTHROPIC_API_KEY', { infer: true })) return 'anthropic';
    if (this.configService.get('GOOGLE_GENERATIVE_AI_API_KEY', { infer: true })) return 'google';
    if (this.configService.get('MISTRAL_API_KEY', { infer: true })) return 'mistral';
    if (this.configService.get('XAI_API_KEY', { infer: true })) return 'xai';
    if (this.configService.get('AWS_ACCESS_KEY_ID', { infer: true })) return 'bedrock';
    return 'openai';
  }

  private createModel(opts?: UnifiedAdapterOpts): LanguageModel {
    switch (this.providerType) {
      case 'anthropic':
        return createAnthropic({
          apiKey: opts?.apiKey ?? this.configService.get('ANTHROPIC_API_KEY', { infer: true }),
        })(this.model);

      case 'google':
        return createGoogleGenerativeAI({
          apiKey: opts?.apiKey ?? this.configService.get('GOOGLE_GENERATIVE_AI_API_KEY', { infer: true }),
        })(this.model);

      case 'mistral':
        return createMistral({
          apiKey: opts?.apiKey ?? this.configService.get('MISTRAL_API_KEY', { infer: true }),
        })(this.model);

      case 'xai':
        return createXai({
          apiKey: opts?.apiKey ?? this.configService.get('XAI_API_KEY', { infer: true }),
        })(this.model);

      case 'azure':
        return createOpenAI({
          apiKey: opts?.apiKey ?? this.configService.get('AZURE_OPENAI_API_KEY', { infer: true }) ?? '',
          baseURL: opts?.baseURL ?? this.configService.get('AZURE_OPENAI_ENDPOINT', { infer: true }),
        })(this.model);

      case 'bedrock':
        return createAmazonBedrock({
          region: this.configService.get('AWS_REGION', { infer: true }) ?? 'us-east-1',
          accessKeyId: opts?.apiKey ?? this.configService.get('AWS_ACCESS_KEY_ID', { infer: true }),
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY', { infer: true }),
        })(this.model);

      case 'openai-compatible':
        return createOpenAI({
          apiKey: opts?.apiKey ?? this.configService.get('OPENAI_API_KEY', { infer: true }) ?? '',
          baseURL: opts?.baseURL ?? this.configService.get('OPENAI_BASE_URL', { infer: true }),
        })(this.model);

      default:
        return createOpenAI({
          apiKey: opts?.apiKey ?? this.configService.get('OPENAI_API_KEY', { infer: true }) ?? '',
          baseURL: opts?.baseURL ?? this.configService.get('OPENAI_BASE_URL', { infer: true }) ?? 'https://api.openai.com/v1',
        })(this.model);
    }
  }
}
