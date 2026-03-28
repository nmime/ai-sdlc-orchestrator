import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CredentialProxyService } from '../credential-proxy.service';
import { ConfigService } from '@nestjs/config';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_HOST = /^[a-zA-Z0-9._:-]+$/;

function validateId(value: string, name: string): void {
  if (!SAFE_ID.test(value)) {
    throw new BadRequestException(`Invalid ${name}`);
  }
}

function validateHost(value: string): void {
  if (!SAFE_HOST.test(value)) {
    throw new BadRequestException('Invalid host');
  }
}

function makeService(envOverrides: Record<string, string> = {}) {
  const config = {
    get: (key: string) => envOverrides[key] || undefined,
  } as any as ConfigService;
  return new CredentialProxyService(config);
}

describe('CredentialProxyService input validation', () => {
  describe('validateId (direct regex test)', () => {
    it('accepts valid alphanumeric IDs', () => {
      expect(SAFE_ID.test('tenant-123')).toBe(true);
      expect(SAFE_ID.test('my_key_v2')).toBe(true);
      expect(SAFE_ID.test('abc')).toBe(true);
    });

    it('rejects IDs with special characters', () => {
      expect(SAFE_ID.test('bad id!')).toBe(false);
      expect(SAFE_ID.test('../etc/passwd')).toBe(false);
      expect(SAFE_ID.test('$(whoami)')).toBe(false);
      expect(SAFE_ID.test("'; DROP TABLE")).toBe(false);
      expect(SAFE_ID.test('')).toBe(false);
    });

    it('throws BadRequestException via function', () => {
      expect(() => validateId('valid-id', 'test')).not.toThrow();
      expect(() => validateId('../evil', 'test')).toThrow(BadRequestException);
      expect(() => validateId('', 'test')).toThrow(BadRequestException);
    });
  });

  describe('validateHost (direct regex test)', () => {
    it('accepts valid hostnames', () => {
      expect(SAFE_HOST.test('api.anthropic.com')).toBe(true);
      expect(SAFE_HOST.test('localhost:8080')).toBe(true);
      expect(SAFE_HOST.test('192.168.1.1:443')).toBe(true);
    });

    it('rejects hosts with injection characters', () => {
      expect(SAFE_HOST.test('evil.com/path')).toBe(false);
      expect(SAFE_HOST.test('host; rm -rf /')).toBe(false);
      expect(SAFE_HOST.test('$(cmd)')).toBe(false);
    });

    it('throws BadRequestException via function', () => {
      expect(() => validateHost('api.example.com')).not.toThrow();
      expect(() => validateHost('evil.com/../../')).toThrow(BadRequestException);
    });
  });

  describe('getGitCredential', () => {
    it('returns tenant-specific credential from env', async () => {
      const svc = makeService({ 'VCS_TOKEN_MY_TENANT': 'ghp_abc123' });
      const result = await svc.getGitCredential('my-tenant', 'github.com');
      expect(result.username).toBe('oauth2');
      expect(result.password).toBe('ghp_abc123');
    });

    it('falls back to DEFAULT_VCS_TOKEN', async () => {
      const svc = makeService({ 'DEFAULT_VCS_TOKEN': 'ghp_default' });
      const result = await svc.getGitCredential('tenant-1', 'github.com');
      expect(result.password).toBe('ghp_default');
    });

    it('returns empty password when no token configured', async () => {
      const svc = makeService();
      const result = await svc.getGitCredential('tenant-1', 'github.com');
      expect(result.password).toBe('');
    });

    it('rejects tenantId with special characters', async () => {
      const svc = makeService();
      await expect(svc.getGitCredential('../etc', 'github.com')).rejects.toThrow(BadRequestException);
    });

    it('rejects host with injection characters', async () => {
      const svc = makeService();
      await expect(svc.getGitCredential('tenant-1', 'host;rm -rf')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMcpToken', () => {
    it('returns token for configured server', async () => {
      const svc = makeService({ 'MCP_TOKEN_MY_SERVER': 'mcp-token-123' });
      const result = await svc.getMcpToken('tenant-1', 'my-server');
      expect(result.token).toBe('mcp-token-123');
      expect(result.expiresAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('rejects invalid serverName', async () => {
      const svc = makeService();
      await expect(svc.getMcpToken('tenant-1', 'bad server!')).rejects.toThrow(BadRequestException);
    });
  });

  describe('proxyAiRequest header construction', () => {
    it('constructs Anthropic headers with x-api-key', async () => {
      const svc = makeService({ 'ANTHROPIC_API_KEY': 'sk-ant-test' });
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as any;
      try {
        await svc.proxyAiRequest('anthropic', '/v1/messages', {}, {});
        expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages');
        expect(capturedHeaders['x-api-key']).toBe('sk-ant-test');
        expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('uses custom anthropic-version header when provided', async () => {
      const svc = makeService({ 'ANTHROPIC_API_KEY': 'sk-ant-test' });
      let capturedHeaders: Record<string, string> = {};
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (_: any, opts: any) => {
        capturedHeaders = opts.headers;
        return new Response('{}', { status: 200 });
      }) as any;
      try {
        await svc.proxyAiRequest('anthropic', '/v1/messages', {}, { 'anthropic-version': '2024-01-01' });
        expect(capturedHeaders['anthropic-version']).toBe('2024-01-01');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('constructs OpenAI headers with Bearer token', async () => {
      const svc = makeService({ 'OPENAI_API_KEY': 'sk-openai-test' });
      let capturedHeaders: Record<string, string> = {};
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (_: any, opts: any) => {
        capturedHeaders = opts.headers;
        return new Response('{}', { status: 200 });
      }) as any;
      try {
        await svc.proxyAiRequest('openai', '/v1/completions', {}, {});
        expect(capturedHeaders['Authorization']).toBe('Bearer sk-openai-test');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('rejects unknown provider', async () => {
      const svc = makeService();
      await expect(svc.proxyAiRequest('unknown', '/v1/x', {}, {})).rejects.toThrow(/Unknown AI provider/);
    });

    it('rejects provider with injection chars', async () => {
      const svc = makeService();
      await expect(svc.proxyAiRequest('bad;provider', '/x', {}, {})).rejects.toThrow(BadRequestException);
    });

    it('rejects when no API key configured', async () => {
      const svc = makeService();
      await expect(svc.proxyAiRequest('anthropic', '/v1/messages', {}, {})).rejects.toThrow(/No API key/);
    });
  });
});
