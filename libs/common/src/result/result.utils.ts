import { Result, ok, err, ResultAsync } from 'neverthrow';
import type { AppError, ErrorCode } from './app-error';

export class ResultUtils {
  static ok<T>(value: T): Result<T, AppError> {
    return ok(value);
  }

  static err<T = never>(code: ErrorCode, message: string, details?: Record<string, unknown>): Result<T, AppError> {
    return err({ code, message, details });
  }

  static fromPromise<T>(promise: Promise<T>, code: ErrorCode = 'INTERNAL_ERROR'): ResultAsync<T, AppError> {
    return ResultAsync.fromPromise(promise, (error) => ({
      code,
      message: error instanceof Error ? error.message : String(error),
    }));
  }

  static async unwrapOrThrow<T>(result: Result<T, AppError>): Promise<T> {
    if (result.isOk()) return result.value;
    throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
}
