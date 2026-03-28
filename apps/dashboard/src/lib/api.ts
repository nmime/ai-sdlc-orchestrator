import { getAuth } from './auth';

const API_BASE = '/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  } else {
    headers['Authorization'] = 'Bearer dev-dashboard';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export function getTenantId(): string {
  const auth = getAuth();
  return auth?.tenantId || '00000000-0000-0000-0000-000000000001';
}
