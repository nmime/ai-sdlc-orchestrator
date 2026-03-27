import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';

function mockRequest(authHeader?: string) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined as any,
  };
}

function mockContext(request: ReturnType<typeof mockRequest>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('AuthGuard', () => {
  const mockApiKeyService = {
    validate: vi.fn(),
  };

  describe('no auth header', () => {
    const configService = { get: vi.fn() } as any;
    const guard = new AuthGuard(configService, mockApiKeyService as any);

    it('should return false when no authorization header', async () => {
      const req = mockRequest();
      expect(await guard.canActivate(mockContext(req))).toBe(false);
    });
  });

  describe('unsupported auth scheme', () => {
    const configService = { get: vi.fn() } as any;
    const guard = new AuthGuard(configService, mockApiKeyService as any);

    it('should return false for unknown auth scheme', async () => {
      const req = mockRequest('Basic dXNlcjpwYXNz');
      expect(await guard.canActivate(mockContext(req))).toBe(false);
    });
  });

  describe('Bearer token (OIDC)', () => {
    it('should use dev-mode bypass when OIDC not configured in development', async () => {
      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer some-token');

      const result = await guard.canActivate(mockContext(req));

      expect(result).toBe(true);
      expect(req.user).toEqual({
        id: 'dev-user',
        email: 'dev@local',
        role: 'viewer',
        tenantId: 'dev-tenant',
      });
    });

    it('should throw UnauthorizedException when OIDC not configured in production', async () => {
      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer some-token');

      await expect(guard.canActivate(mockContext(req))).rejects.toThrow(UnauthorizedException);
    });

    it('should return false on OIDC fetch failure', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer some-token');

      expect(await guard.canActivate(mockContext(req))).toBe(false);

      globalThis.fetch = originalFetch;
    });

    it('should return false on non-ok OIDC response', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer bad-token');

      expect(await guard.canActivate(mockContext(req))).toBe(false);

      globalThis.fetch = originalFetch;
    });

    it('should set user from OIDC userinfo on success', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'user-123', email: 'alice@example.com', role: 'admin', tenant_id: 'tenant-abc' }),
      });

      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer valid-token');

      expect(await guard.canActivate(mockContext(req))).toBe(true);
      expect(req.user).toEqual({
        id: 'user-123',
        email: 'alice@example.com',
        role: 'admin',
        tenantId: 'tenant-abc',
      });

      globalThis.fetch = originalFetch;
    });

    it('should fallback invalid role to viewer', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'user-1', role: 'superadmin', tenant_id: 't1' }),
      });

      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer valid-token');

      await guard.canActivate(mockContext(req));
      expect(req.user.role).toBe('viewer');

      globalThis.fetch = originalFetch;
    });

    it('should default to viewer when role is undefined', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'user-1', tenant_id: 't1' }),
      });

      const configService = { get: vi.fn((key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }) } as any;
      const guard = new AuthGuard(configService, mockApiKeyService as any);
      const req = mockRequest('Bearer valid-token');

      await guard.canActivate(mockContext(req));
      expect(req.user.role).toBe('viewer');

      globalThis.fetch = originalFetch;
    });
  });

  describe('ApiKey auth', () => {
    it('should set user from valid API key', async () => {
      const configService = { get: vi.fn() } as any;
      const apiKeyService = {
        validate: vi.fn().mockResolvedValue({
          isErr: () => false,
          value: { id: 'key-1', role: 'operator', tenant: { id: 'tenant-xyz' } },
        }),
      };
      const guard = new AuthGuard(configService, apiKeyService as any);
      const req = mockRequest('ApiKey asdlc_abc123');

      expect(await guard.canActivate(mockContext(req))).toBe(true);
      expect(req.user).toEqual({
        id: 'apikey-key-1',
        role: 'operator',
        tenantId: 'tenant-xyz',
      });
    });

    it('should return false for invalid API key', async () => {
      const configService = { get: vi.fn() } as any;
      const apiKeyService = {
        validate: vi.fn().mockResolvedValue({
          isErr: () => true,
        }),
      };
      const guard = new AuthGuard(configService, apiKeyService as any);
      const req = mockRequest('ApiKey invalid-key');

      expect(await guard.canActivate(mockContext(req))).toBe(false);
    });

    it('should fallback invalid API key role to viewer', async () => {
      const configService = { get: vi.fn() } as any;
      const apiKeyService = {
        validate: vi.fn().mockResolvedValue({
          isErr: () => false,
          value: { id: 'key-1', role: 'superadmin', tenant: { id: 't1' } },
        }),
      };
      const guard = new AuthGuard(configService, apiKeyService as any);
      const req = mockRequest('ApiKey asdlc_abc123');

      await guard.canActivate(mockContext(req));
      expect(req.user.role).toBe('viewer');
    });
  });
});
