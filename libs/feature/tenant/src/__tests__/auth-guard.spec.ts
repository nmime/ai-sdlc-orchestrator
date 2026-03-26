import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import type { ApiKeyService } from '../api-key.service';
import { AuthGuard } from '../guards/auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const mockApiKeyService: Record<string, ReturnType<typeof vi.fn>> = {
  validate: vi.fn(),
};

const mockConfigService: Record<string, ReturnType<typeof vi.fn>> = {
  get: vi.fn(),
};

function mockContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as unknown as ExecutionContext & { _request: typeof request };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new AuthGuard(
      mockConfigService as unknown as ConfigService,
      mockApiKeyService as unknown as ApiKeyService,
    );
  });

  it('throws when no authorization header', async () => {
    const ctx = mockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws for unsupported auth scheme', async () => {
    const ctx = mockContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Unsupported authorization scheme');
  });

  it('allows dev mode when no OIDC issuer', async () => {
    mockConfigService.get.mockImplementation((key: string) => key === 'NODE_ENV' ? 'test' : undefined);
    const ctx = mockContext({ authorization: 'Bearer some-token' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(ctx._request.user).toEqual({
      id: 'dev-user',
      email: 'dev@local',
      role: 'viewer',
      tenantId: 'dev-tenant',
    });
  });

  it('validates API key and sets user', async () => {
    const { ok } = await import('neverthrow');
    mockApiKeyService.validate.mockResolvedValue(ok({
      id: 'key-1',
      name: 'test-key',
      role: 'operator',
      tenant: { id: 'tenant-abc' },
    }));
    const ctx = mockContext({ authorization: 'ApiKey raw-key-value' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    const user = ctx._request.user as Record<string, unknown>;
    expect(user.role).toBe('operator');
    expect(user.tenantId).toBe('tenant-abc');
  });

  it('throws when API key validation fails', async () => {
    const { err } = await import('neverthrow');
    mockApiKeyService.validate.mockResolvedValue(err({ code: 'UNAUTHORIZED', message: 'Invalid key' }));
    const ctx = mockContext({ authorization: 'ApiKey invalid-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
