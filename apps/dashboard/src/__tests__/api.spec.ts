import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => mockLocalStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockLocalStorage[k] = v; },
    removeItem: (k: string) => { delete mockLocalStorage[k]; },
  },
  writable: true,
});

import { apiFetch, getTenantId } from '../lib/api';

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
  });

  describe('apiFetch', () => {
    it('makes fetch call with default auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      const result = await apiFetch('/workflows');
      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/workflows', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer dev-dashboard' }),
      }));
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
          Authorization: 'Bearer dev-dashboard',
        }),
      }));
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
