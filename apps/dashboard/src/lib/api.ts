import { getAuth } from './auth';
import toast from 'react-hot-toast';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = undefined; }
    const msg = (parsed && typeof parsed === 'object' && 'message' in parsed)
      ? String((parsed as { message: string }).message)
      : `API ${res.status}: ${text}`;
    if (res.status === 401) {
      const { clearAuth } = await import('./auth');
      clearAuth();
      window.location.href = '/login';
    }
    throw new ApiError(res.status, msg, parsed);
  }
  return res.json();
}

export function getTenantId(): string {
  const auth = getAuth();
  return auth?.tenantId || '00000000-0000-0000-0000-000000000001';
}

export function mutationOptions(successMsg: string) {
  return {
    onSuccess: () => { toast.success(successMsg); },
    onError: (err: Error) => { toast.error(err.message); },
  };
}
