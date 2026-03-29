const AUTH_KEY = 'opwerf_auth';

export interface AuthState {
  token: string;
  tenantId: string;
  role: string;
  email?: string;
  name?: string;
  picture?: string;
  provider?: 'google' | 'dev' | 'api-key';
}

export function getAuth(): AuthState | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(auth: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getAuth();
  if (!auth?.token) return false;
  try {
    const payload = JSON.parse(atob(auth.token.split('.')[1] ?? ''));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuth();
      return false;
    }
    return true;
  } catch {
    return !!auth.token;
  }
}

export function getAuthHeader(): Record<string, string> {
  const auth = getAuth();
  if (!auth?.token) return {};
  return { Authorization: `Bearer ${auth.token}` };
}

export async function validateSession(): Promise<boolean> {
  const auth = getAuth();
  if (!auth?.token) return false;
  try {
    const res = await fetch('/auth/me', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      clearAuth();
      return false;
    }
    return true;
  } catch {
    return isAuthenticated();
  }
}
