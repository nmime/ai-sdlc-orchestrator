import { Result } from 'neverthrow';
import type { AppError } from '@app/common';

export interface SandboxFileContent {
  path: string;
  content: string;
}

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxPort {
  readonly name: string;
  create(config: {
    templateId?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
  }): Promise<Result<{ sandboxId: string }, AppError>>;
  exec(sandboxId: string, command: string, timeoutMs?: number): Promise<Result<SandboxExecResult, AppError>>;
  writeFile(sandboxId: string, path: string, content: string): Promise<Result<void, AppError>>;
  readFile(sandboxId: string, path: string): Promise<Result<string, AppError>>;
  uploadArtifact(sandboxId: string, path: string, destinationUrl: string): Promise<Result<string, AppError>>;
  destroy(sandboxId: string): Promise<Result<void, AppError>>;
  pause(sandboxId: string): Promise<Result<void, AppError>>;
  resume(sandboxId: string): Promise<Result<{ sandboxId: string }, AppError>>;
}
