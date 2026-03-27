const headers: Record<string, string> = {};

export function setAuthToken(token: string) {
  headers['Authorization'] = token;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const mergedHeaders = { ...headers, ...init?.headers };
  return fetch(input, { ...init, headers: mergedHeaders });
}
