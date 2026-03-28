import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mockLocalStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockLocalStorage[k] = v; },
    removeItem: (k: string) => { delete mockLocalStorage[k]; },
  },
  writable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
});

import { apiFetch, getTenantId } from '../lib/api';

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
  });

  describe('apiFetch', () => {
    it('makes fetch call without auth header when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      const result = await apiFetch('/workflows');
      expect(result).toEqual({ data: [] });
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[0]).toBe('/api/v1/workflows');
      expect(callArgs[1]!.headers).not.toHaveProperty('Authorization');
    });

    it('uses token from auth state in localStorage', async () => {
      mockLocalStorage['ai_sdlc_auth'] = JSON.stringify({
        token: 'my-custom-token',
        tenantId: 'tenant-1',
        role: 'admin',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await apiFetch('/test');
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-custom-token' }),
      }));
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
        statusText: 'Not Found',
      });
      await expect(apiFetch('/missing')).rejects.toThrow('API 404: Not Found');
    });

    it('passes through custom headers and method', async () => {
      mockLocalStorage['ai_sdlc_auth'] = JSON.stringify({
        token: 'test-token',
        tenantId: 'tenant-1',
        role: 'admin',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ valid: true }),
      });
      await apiFetch('/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: 'test' }),
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/validate', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }));
    });

    it('clears auth and redirects on 401 response', async () => {
      mockLocalStorage['ai_sdlc_auth'] = JSON.stringify({
        token: 'expired-token',
        tenantId: 'tenant-1',
        role: 'admin',
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
        statusText: 'Unauthorized',
      });
      await expect(apiFetch('/protected')).rejects.toThrow();
      expect(mockLocalStorage).not.toHaveProperty('ai_sdlc_auth');
      expect(window.location.href).toContain('/login');
    });
  });

  describe('getTenantId', () => {
    it('returns default tenant id when no auth', () => {
      expect(getTenantId()).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('returns tenant id from auth state', () => {
      mockLocalStorage['ai_sdlc_auth'] = JSON.stringify({
        token: 'tok',
        tenantId: 'my-tenant-id',
        role: 'user',
      });
      expect(getTenantId()).toBe('my-tenant-id');
    });
  });
});
