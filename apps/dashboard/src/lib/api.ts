import { getAuth } from './auth';
import { getDemoData } from './demo-data';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

let demoMode = false;
let demoToastShown = false;

export function isDemoMode() {
  return demoMode;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (demoMode) {
    const demo = getDemoData(path);
    if (demo !== null) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      return demo as T;
    }
  }

  const auth = getAuth();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

    if (!res.ok) {
      if (res.status === 401) {
        const { clearAuth } = await import('./auth');
        clearAuth();
        window.location.href = '/login';
      }

      const demo = getDemoData(path);
      if (demo !== null) {
        enableDemoMode();
        return demo as T;
      }

      const text = await res.text().catch(() => res.statusText);
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = undefined; }
      const msg = (parsed && typeof parsed === 'object' && 'message' in parsed)
        ? String((parsed as { message: string }).message)
        : `API ${res.status}: ${text}`;
      throw new ApiError(res.status, msg, parsed);
    }
    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;

    const demo = getDemoData(path);
    if (demo !== null) {
      enableDemoMode();
      return demo as T;
    }
    throw err;
  }
}

function enableDemoMode() {
  if (!demoMode) {
    demoMode = true;
    if (!demoToastShown) {
      demoToastShown = true;
      toast('Running in demo mode — showing sample data', { icon: '🎭', duration: 4000 });
    }
  }
}

export function getTenantId(): string {
  const auth = getAuth();
  return auth?.tenantId || '00000000-0000-0000-0000-000000000001';
}

export function mutationOptions(successMsg: string) {
  return {
    onSuccess: () => { toast.success(successMsg); },
    onError: (err: Error) => {
      if (demoMode) {
        toast.success(successMsg + ' (demo)');
        return;
      }
      toast.error(err.message);
    },
  };
}
