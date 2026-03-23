import { ResultUtils } from '../result/result.utils';
import type { AppError } from '../result/app-error';

describe('ResultUtils', () => {
  it('should create an ok result', () => {
    const result = ResultUtils.ok('hello');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('hello');
  });

  it('should create an err result', () => {
    const result = ResultUtils.err('NOT_FOUND', 'Item not found');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
    expect(result._unsafeUnwrapErr().message).toBe('Item not found');
  });

  it('should create err with details', () => {
    const result = ResultUtils.err('VALIDATION_ERROR', 'Invalid', { field: 'name' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().details).toEqual({ field: 'name' });
  });

  it('should unwrap ok result', async () => {
    const result = ResultUtils.ok(42);
    const value = await ResultUtils.unwrapOrThrow(result);
    expect(value).toBe(42);
  });

  it('should throw on unwrap err result', async () => {
    const result = ResultUtils.err('INTERNAL_ERROR', 'something broke');
    await expect(ResultUtils.unwrapOrThrow(result)).rejects.toThrow('[INTERNAL_ERROR] something broke');
  });

  it('should wrap a promise in ResultAsync', async () => {
    const result = await ResultUtils.fromPromise(Promise.resolve('async-value'));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('async-value');
  });

  it('should handle rejected promise', async () => {
    const result = await ResultUtils.fromPromise(Promise.reject(new Error('async-fail')), 'AGENT_ERROR');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('AGENT_ERROR');
    expect(result._unsafeUnwrapErr().message).toBe('async-fail');
  });
});
