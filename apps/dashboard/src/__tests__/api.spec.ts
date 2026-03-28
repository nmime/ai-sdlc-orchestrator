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

import { apiFetch, setApiToken, getApiToken } from '../lib/api';

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
  });

  describe('apiFetch', () => {
    it('makes fetch call with auth header', async () => {
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

    it('uses custom token from localStorage', async () => {
      mockLocalStorage['api_token'] = 'my-custom-token';
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

  describe('setApiToken / getApiToken', () => {
    it('stores and retrieves token', () => {
      setApiToken('new-token');
      expect(getApiToken()).toBe('new-token');
    });

    it('returns empty string when no token set', () => {
      expect(getApiToken()).toBe('');
    });
  });
});
