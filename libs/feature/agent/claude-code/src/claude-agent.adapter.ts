import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService, sanitizeLog } from '@app/common';
import type { AppError, AppConfig } from '@app/common';
import type { AiAgentPort } from '@app/feature-agent-registry';
import type { AgentInvokeInput, AgentInvokeOutput, PublishedArtifact } from '@app/shared-type';

interface ToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
}

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
      this.logger.log(`Invoking Claude agent for session ${sanitizeLog(input.sessionId)}`);
      const startTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let filesChanged = 0;
      const artifacts: PublishedArtifact[] = [];
      const toolResults: ToolResult[] = [];

      const tools: Anthropic.Tool[] = [
        {
          name: 'execute_command',
          description: 'Execute a shell command in the sandbox. Use for git, build, test, lint operations.',
          input_schema: {
            type: 'object' as const,
            properties: {
              command: { type: 'string', description: 'Shell command to execute' },
              workdir: { type: 'string', description: 'Working directory (default: /home/user/repo)' },
            },
            required: ['command'],
          },
        },
        {
          name: 'write_file',
          description: 'Create or overwrite a file in the sandbox.',
          input_schema: {
            type: 'object' as const,
            properties: {
              path: { type: 'string', description: 'File path relative to repo root' },
              content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'read_file',
          description: 'Read a file from the sandbox.',
          input_schema: {
            type: 'object' as const,
            properties: {
              path: { type: 'string', description: 'File path relative to repo root' },
            },
            required: ['path'],
          },
        },
        {
          name: 'search_files',
          description: 'Search for text patterns across files using grep.',
          input_schema: {
            type: 'object' as const,
            properties: {
              pattern: { type: 'string', description: 'Search pattern (regex)' },
              path: { type: 'string', description: 'Directory to search (default: .)' },
              include: { type: 'string', description: 'File glob pattern (e.g., *.ts)' },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'list_files',
          description: 'List files in a directory.',
          input_schema: {
            type: 'object' as const,
            properties: {
              path: { type: 'string', description: 'Directory path (default: .)' },
              recursive: { type: 'boolean', description: 'List recursively' },
            },
            required: [],
          },
        },
      ];

      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: 'Execute the task described in the system prompt. Clone the repo, create a branch, implement the changes, run tests, commit, and push. Report what you did.',
        },
      ];

      const maxTurns = parseInt(this.configService.get('AGENT_MAX_TURNS', { infer: true }) || '25', 10);
      let turn = 0;
      let costAccumulated = 0;

      while (turn < maxTurns && costAccumulated < input.maxCostUsd) {
        turn++;

        const response = await this.client.messages.create({
          model: this.configService.get('DEFAULT_AGENT_MODEL') || 'claude-sonnet-4-20250514',
          max_tokens: 16384,
          system: input.prompt,
          tools,
          messages,
        });

        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
        costAccumulated = this.calculateCost(totalInputTokens, totalOutputTokens);

        if (response.stop_reason === 'end_turn') {
          this.logger.log(`Agent completed after ${turn} turns`);
          break;
        }

        if (response.stop_reason !== 'tool_use') break;

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use',
        );

        if (toolUseBlocks.length === 0) break;

        messages.push({ role: 'assistant', content: response.content });

        const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const toolStart = Date.now();
          let output: string;

          try {
            output = await this.executeTool(toolUse.name, toolUse.input as Record<string, unknown>, input.sandboxId, input.credentialProxyUrl);
            if (toolUse.name === 'write_file') filesChanged++;
          } catch (error) {
            output = `Error: ${(error as Error).message}`;
          }

          toolResults.push({
            toolName: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output: output.slice(0, 500),
            durationMs: Date.now() - toolStart,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: output.slice(0, 50000),
          });
        }

        messages.push({ role: 'user', content: toolResultContents });
      }

      const aiCostUsd = this.calculateCost(totalInputTokens, totalOutputTokens);
      const durationMs = Date.now() - startTime;
      const sandboxCostRate = parseFloat(this.configService.get('SANDBOX_COST_PER_HOUR_USD', { infer: true }) || '0.05');
      const sandboxCostUsd = (durationMs / 3_600_000) * sandboxCostRate;

      this.logger.log(`Session ${sanitizeLog(input.sessionId)} completed in ${durationMs}ms, ${turn} turns, cost: ${aiCostUsd.toFixed(4)}`);

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
      this.logger.error(`Session ${sanitizeLog(input.sessionId)} failed: ${sanitizeLog((error as Error).message)}`);
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

  private async executeTool(name: string, args: Record<string, unknown>, sandboxId: string, credentialProxyUrl?: string): Promise<string> {
    const baseUrl = credentialProxyUrl || 'http://localhost:4000';
    switch (name) {
      case 'execute_command': {
        const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: args['command'], workdir: args['workdir'] || '/home/user/repo' }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`;
        const result = await res.json() as { stdout: string; stderr: string; exitCode: number };
        return `exit_code=${result.exitCode}
${result.stdout}${result.stderr ? '\nSTDERR:\n' + result.stderr : ''}`;
      }
      case 'write_file': {
        const sanitizedWritePath = this.sanitizePath(String(args['path'] || ''), '/home/user/repo');
        const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: sanitizedWritePath, content: args['content'] }),
          signal: AbortSignal.timeout(30_000),
        });
        return res.ok ? `Written: ${sanitizedWritePath}` : `Failed: ${await res.text()}`;
      }
      case 'read_file': {
        const sanitizedReadPath = this.sanitizePath(String(args['path'] || ''), '/home/user/repo');
        const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/read?path=${encodeURIComponent(sanitizedReadPath)}`, {
          signal: AbortSignal.timeout(30_000),
        });
        return res.ok ? await res.text() : `Failed: ${await res.text()}`;
      }
      case 'search_files': {
        const safePattern = String(args['pattern']).replace(/'/g, "'\\''").replace(/[`$\\]/g, '\\$&');
        const safeInclude = args['include'] ? `--include=${String(args['include']).replace(/[^a-zA-Z0-9.*?_\-/]/g, '')}` : '';
        const sanitizedSearchPath = this.sanitizePath(String(args['path'] || '.'), '/home/user/repo');
        const cmd = `grep -rn ${safeInclude} -- '${safePattern}' '${sanitizedSearchPath}' | head -50`;
        return this.executeTool('execute_command', { command: cmd }, sandboxId, credentialProxyUrl);
      }
      case 'list_files': {
        const sanitizedListPath = this.sanitizePath(String(args['path'] || '.'), '/home/user/repo');
        const cmd = args['recursive'] ? `find '${sanitizedListPath}' -type f | head -100` : `ls -la '${sanitizedListPath}'`;
        return this.executeTool('execute_command', { command: cmd }, sandboxId, credentialProxyUrl);
      }
      default:
        return `Unknown tool: ${name}`;
    }
  }

  private sanitizePath(userPath: string, root: string): string {
    const resolved = path.resolve(root, String(userPath || '.').replace(/[^a-zA-Z0-9._\-/]/g, ''));
    if (!resolved.startsWith(root)) return root;
    return resolved;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCostPer1M = parseFloat(this.configService.get('AI_INPUT_COST_PER_1M', { infer: true }) || '3.0');
    const outputCostPer1M = parseFloat(this.configService.get('AI_OUTPUT_COST_PER_1M', { infer: true }) || '15.0');
    return (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1_000_000;
  }
}
