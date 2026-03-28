import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import type { ExecutionContext } from '@nestjs/common';

function mockContext(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers, user: undefined as any };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    getArgs: () => [request],
    getArgByIndex: () => request,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
  } as any;
}

describe('AuthGuard', () => {
  describe('missing/invalid headers', () => {
    it('throws on missing authorization header', async () => {
      const guard = new AuthGuard({ get: () => undefined } as any, {} as any);
      await expect(guard.canActivate(mockContext({}))).rejects.toThrow('Missing authorization header');
    });

    it('throws on unsupported scheme', async () => {
      const guard = new AuthGuard({ get: () => undefined } as any, {} as any);
      await expect(guard.canActivate(mockContext({ authorization: 'Basic abc' }))).rejects.toThrow('Unsupported authorization scheme');
    });
  });

  describe('Bearer token — dev bypass', () => {
    it('allows dev bypass in development mode', async () => {
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ALLOW_DEV_AUTH_BYPASS') return 'true';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      const ctx = mockContext({ authorization: 'Bearer any-token' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest() as any;
      expect(req.user.id).toBe('dev-user');
      expect(req.user.email).toBe('dev@local');
      expect(req.user.role).toBe('admin');
      expect(req.user.tenantId).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('allows dev bypass in test mode', async () => {
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'test';
        if (key === 'ALLOW_DEV_AUTH_BYPASS') return 'true';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      const result = await guard.canActivate(mockContext({ authorization: 'Bearer x' }));
      expect(result).toBe(true);
    });

    it('rejects in production when OIDC not configured', async () => {
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      await expect(guard.canActivate(mockContext({ authorization: 'Bearer x' })))
        .rejects.toThrow('OIDC not configured');
    });

    it('rejects in development when ALLOW_DEV_AUTH_BYPASS is not true', async () => {
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return '';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ALLOW_DEV_AUTH_BYPASS') return 'false';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      await expect(guard.canActivate(mockContext({ authorization: 'Bearer x' })))
        .rejects.toThrow('ALLOW_DEV_AUTH_BYPASS');
    });
  });

  describe('Bearer token — OIDC/JWT validation', () => {
    it('rejects expired JWT', async () => {
      const jose = await import('jose');
      const { privateKey } = await jose.generateKeyPair('RS256');
      const jwt = await new jose.SignJWT({ sub: 'user-1' })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .setIssuer('https://auth.example.com')
        .sign(privateKey);

      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'OIDC_CLIENT_ID') return '';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      (guard as any).jwks = jose.createLocalJWKSet({ keys: [] });

      await expect(guard.canActivate(mockContext({ authorization: `Bearer ${jwt}` })))
        .rejects.toThrow(/expired|validation failed/i);
    });

    it('rejects token with invalid signature', async () => {
      const jose = await import('jose');
      const { privateKey: signingKey } = await jose.generateKeyPair('RS256');
      const { publicKey: wrongKey } = await jose.generateKeyPair('RS256');

      const jwt = await new jose.SignJWT({ sub: 'user-1' })
        .setProtectedHeader({ alg: 'RS256' })
        .setExpirationTime('1h')
        .setIssuer('https://auth.example.com')
        .sign(signingKey);

      const jwkSet = await jose.exportJWK(wrongKey);
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'OIDC_CLIENT_ID') return '';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      (guard as any).jwks = jose.createLocalJWKSet({ keys: [{ ...jwkSet, kid: 'key-1' }] });

      await expect(guard.canActivate(mockContext({ authorization: `Bearer ${jwt}` })))
        .rejects.toThrow(/signature|validation failed/i);
    });

    it('extracts user claims from valid JWT', async () => {
      const jose = await import('jose');
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

      const jwt = await new jose.SignJWT({
        sub: 'user-42',
        email: 'alice@example.com',
        role: 'operator',
        tenant_id: 'tenant-abc',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setExpirationTime('1h')
        .setIssuer('https://auth.example.com')
        .sign(privateKey);

      const jwkSet = await jose.exportJWK(publicKey);
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'OIDC_CLIENT_ID') return '';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      (guard as any).jwks = jose.createLocalJWKSet({ keys: [{ ...jwkSet, kid: 'key-1' }] });

      const ctx = mockContext({ authorization: `Bearer ${jwt}` });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest() as any;
      expect(req.user.id).toBe('user-42');
      expect(req.user.email).toBe('alice@example.com');
      expect(req.user.role).toBe('operator');
      expect(req.user.tenantId).toBe('tenant-abc');
    });

    it('defaults role to viewer when not in claims', async () => {
      const jose = await import('jose');
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

      const jwt = await new jose.SignJWT({ sub: 'user-99' })
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setExpirationTime('1h')
        .setIssuer('https://auth.example.com')
        .sign(privateKey);

      const jwkSet = await jose.exportJWK(publicKey);
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'OIDC_CLIENT_ID') return '';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      (guard as any).jwks = jose.createLocalJWKSet({ keys: [{ ...jwkSet, kid: 'key-1' }] });

      const ctx = mockContext({ authorization: `Bearer ${jwt}` });
      await guard.canActivate(ctx);
      expect((ctx.switchToHttp().getRequest() as any).user.role).toBe('viewer');
    });

    it('reads tenantId from tenantId claim fallback', async () => {
      const jose = await import('jose');
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256');

      const jwt = await new jose.SignJWT({ sub: 'u1', tenantId: 'tid-fallback' })
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setExpirationTime('1h')
        .setIssuer('https://auth.example.com')
        .sign(privateKey);

      const jwkSet = await jose.exportJWK(publicKey);
      const config = { get: (key: string) => {
        if (key === 'OIDC_ISSUER_URL') return 'https://auth.example.com';
        if (key === 'OIDC_CLIENT_ID') return '';
        return undefined;
      }};
      const guard = new AuthGuard(config as any, {} as any);
      (guard as any).jwks = jose.createLocalJWKSet({ keys: [{ ...jwkSet, kid: 'key-1' }] });

      const ctx = mockContext({ authorization: `Bearer ${jwt}` });
      await guard.canActivate(ctx);
      expect((ctx.switchToHttp().getRequest() as any).user.tenantId).toBe('tid-fallback');
    });
  });

  describe('ApiKey auth', () => {
    it('validates API key and sets user', async () => {
      const mockApiKeyService = {
        validate: vi.fn().mockResolvedValue({
          isErr: () => false,
          isOk: () => true,
          value: { id: 'key-1', name: 'ci-key', role: 'operator', tenant: { id: 'tenant-1' } },
        }),
      };
      const guard = new AuthGuard({ get: () => undefined } as any, mockApiKeyService as any);
      const ctx = mockContext({ authorization: 'ApiKey asdlc_abc123' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest() as any;
      expect(req.user.id).toBe('apikey:key-1');
      expect(req.user.email).toBe('apikey:ci-key');
      expect(req.user.role).toBe('operator');
      expect(req.user.tenantId).toBe('tenant-1');
    });

    it('rejects invalid API key', async () => {
      const mockApiKeyService = {
        validate: vi.fn().mockResolvedValue({
          isErr: () => true,
          error: { message: 'Invalid API key' },
        }),
      };
      const guard = new AuthGuard({ get: () => undefined } as any, mockApiKeyService as any);
      await expect(guard.canActivate(mockContext({ authorization: 'ApiKey bad-key' })))
        .rejects.toThrow('Invalid API key');
    });
  });
});
