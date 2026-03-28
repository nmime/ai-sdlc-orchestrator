import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppErrorExceptionFilter } from '../filters/app-error-exception.filter';

function createMockHost(reply: { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }) {
  reply.status.mockReturnValue(reply);
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({}),
    }),
  } as any;
}

describe('AppErrorExceptionFilter', () => {
  const filter = new AppErrorExceptionFilter();

  it('handles HttpException', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'ERROR', message: 'Not Found', statusCode: 404 });
  });

  it('handles HttpException with object response', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new HttpException({ message: 'Bad', statusCode: 400 }, 400), host);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ message: 'Bad', statusCode: 400 });
  });

  it('handles MikroORM NotFoundError', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    const err = new Error('Entity not found');
    Object.setPrototypeOf(err, { constructor: { name: 'NotFoundError' } });
    (err as any).name = 'NotFoundError';
    const { NotFoundError } = require('@mikro-orm/core');
    const notFoundErr = Object.create(NotFoundError.prototype);
    notFoundErr.message = 'not found';
    filter.catch(notFoundErr, host);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('handles unique violation (code 23505)', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    const err = new Error('duplicate key') as any;
    err.code = '23505';
    filter.catch(err, host);
    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'CONFLICT' }));
  });

  it('handles [ERROR_CODE] message pattern', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new Error('[BUDGET_EXCEEDED] over limit'), host);
    expect(reply.status).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
  });

  it('handles [NOT_FOUND] error code', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new Error('[NOT_FOUND] missing'), host);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('handles [RATE_LIMITED] error code', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new Error('[RATE_LIMITED] slow down'), host);
    expect(reply.status).toHaveBeenCalledWith(429);
  });

  it('defaults to 500 for unknown errors', () => {
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    const host = createMockHost(reply);
    filter.catch(new Error('something broke'), host);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'INTERNAL_ERROR' }));
  });
});
