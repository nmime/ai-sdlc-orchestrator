import { AuthGuard } from '../guards/auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const mockApiKeyService = {
  validate: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

function mockContext(headers: Record<string, string> = {}): any {
  const request = { headers, user: undefined as any };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new AuthGuard(mockConfigService as any, mockApiKeyService as any);
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
    mockConfigService.get.mockReturnValue(undefined);
    const ctx = mockContext({ authorization: 'Bearer some-token' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(ctx._request.user).toEqual({
      id: 'dev-user',
      email: 'dev@local',
      role: 'admin',
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
    expect(ctx._request.user.role).toBe('operator');
    expect(ctx._request.user.tenantId).toBe('tenant-abc');
  });

  it('throws when API key validation fails', async () => {
    const { err } = await import('neverthrow');
    mockApiKeyService.validate.mockResolvedValue(err({ code: 'UNAUTHORIZED', message: 'Invalid key' }));
    const ctx = mockContext({ authorization: 'ApiKey invalid-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
