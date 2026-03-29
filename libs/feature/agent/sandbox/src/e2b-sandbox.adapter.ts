import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Sandbox } from 'e2b';
import { type Result, err } from 'neverthrow';
import { ResultUtils, type PinoLoggerService } from '@app/common';
import type { AppError, AppConfig } from '@app/common';
import type { SandboxPort, SandboxExecResult } from '@app/feature-agent-registry';

@Injectable()
export class E2bSandboxAdapter implements SandboxPort {
  readonly name = 'e2b';
  private sandboxes = new Map<string, Sandbox>();

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('E2bSandboxAdapter');
  }

  async create(config: {
    templateId?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
  }): Promise<Result<{ sandboxId: string }, AppError>> {
    try {
      const sandbox = await Sandbox.create(config.templateId || 'base', {
        apiKey: this.configService.get('E2B_API_KEY'),
        timeoutMs: config.timeoutMs || 600_000,
        envs: config.env,
      });

      this.sandboxes.set(sandbox.sandboxId, sandbox);
      this.logger.log(`Sandbox created: ${sandbox.sandboxId}`);

      return ResultUtils.ok({ sandboxId: sandbox.sandboxId });
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Failed to create sandbox: ${(error as Error).message}`);
    }
  }

  async exec(sandboxId: string, command: string, timeoutMs?: number): Promise<Result<SandboxExecResult, AppError>> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return ResultUtils.err('NOT_FOUND', `Sandbox ${sandboxId} not found`);

    try {
      const result = await sandbox.commands.run(command, { timeoutMs: timeoutMs || 60_000 });
      return ResultUtils.ok({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Exec failed: ${(error as Error).message}`);
    }
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<Result<void, AppError>> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return ResultUtils.err('NOT_FOUND', `Sandbox ${sandboxId} not found`);

    try {
      await sandbox.files.write(path, content);
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Write failed: ${(error as Error).message}`);
    }
  }

  async readFile(sandboxId: string, path: string): Promise<Result<string, AppError>> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return ResultUtils.err('NOT_FOUND', `Sandbox ${sandboxId} not found`);

    try {
      const content = await sandbox.files.read(path);
      return ResultUtils.ok(content);
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Read failed: ${(error as Error).message}`);
    }
  }

  async uploadArtifact(sandboxId: string, path: string, destinationUrl: string): Promise<Result<string, AppError>> {
    const readResult = await this.readFile(sandboxId, path);
    if (readResult.isErr()) return err(readResult.error);

    try {
      const buffer = Buffer.from(readResult.value, 'utf-8');
      const res = await fetch(destinationUrl, {
        method: 'PUT',
        body: buffer,
        headers: { 'Content-Length': String(buffer.length) },
      });
      if (!res.ok) {
        return ResultUtils.err('SANDBOX_ERROR', `Upload failed: HTTP ${res.status}`);
      }
      this.logger.log(`Artifact uploaded from ${path} to ${destinationUrl}`);
      return ResultUtils.ok(destinationUrl);
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Upload failed: ${(error as Error).message}`);
    }
  }

  async destroy(sandboxId: string): Promise<Result<void, AppError>> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return ResultUtils.err('NOT_FOUND', `Sandbox ${sandboxId} not found`);

    try {
      await sandbox.kill();
      this.sandboxes.delete(sandboxId);
      this.logger.log(`Sandbox destroyed: ${sandboxId}`);
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Destroy failed: ${(error as Error).message}`);
    }
  }

  async pause(sandboxId: string): Promise<Result<void, AppError>> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return ResultUtils.err('NOT_FOUND', `Sandbox ${sandboxId} not found`);

    try {
      const apiKey = this.configService.get('E2B_API_KEY');
      const res = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/pause`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return ResultUtils.ok(undefined);
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Pause failed: ${(error as Error).message}`);
    }
  }

  async resume(sandboxId: string): Promise<Result<{ sandboxId: string }, AppError>> {
    try {
      const apiKey = this.configService.get('E2B_API_KEY');
      const res = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/resume`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json() as { sandboxId: string };
      const sandbox = await Sandbox.connect(data.sandboxId, { apiKey });
      this.sandboxes.set(sandbox.sandboxId, sandbox);
      return ResultUtils.ok({ sandboxId: sandbox.sandboxId });
    } catch (error) {
      return ResultUtils.err('SANDBOX_ERROR', `Resume failed: ${(error as Error).message}`);
    }
  }
}
