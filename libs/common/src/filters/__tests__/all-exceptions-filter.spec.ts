import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function createMockHost(requestOverrides: Partial<{ method: string; url: string }> = {}) {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  const request = {
    method: requestOverrides.method || 'GET',
    url: requestOverrides.url || '/test',
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as any;

  return { host, reply, request };
}

describe('AllExceptionsFilter', () => {
  const config = { get: vi.fn() } as any;
  const filter = new AllExceptionsFilter(config);

  it('should handle HttpException with correct status', () => {
    const { host, reply } = createMockHost();
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Bad Request',
        path: '/test',
      }),
    );
  });

  it('should handle unknown exceptions as 500', () => {
    const { host, reply } = createMockHost();
    filter.catch(new Error('unknown'), host);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should handle non-Error exceptions as 500', () => {
    const { host, reply } = createMockHost();
    filter.catch('string-error', host);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  it('should include timestamp in response', () => {
    const { host, reply } = createMockHost();
    filter.catch(new Error('test'), host);
    const body = reply.send.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('should include correct path', () => {
    const { host, reply } = createMockHost({ url: '/api/tenants/123' });
    filter.catch(new Error('test'), host);
    expect(reply.send.mock.calls[0][0].path).toBe('/api/tenants/123');
  });

  it('should handle 403 Forbidden', () => {
    const { host, reply } = createMockHost();
    filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it('should handle 404 Not Found', () => {
    const { host, reply } = createMockHost();
    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send.mock.calls[0][0].message).toBe('Not Found');
  });
});
