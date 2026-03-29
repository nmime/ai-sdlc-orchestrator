import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { setAuth } from '../lib/auth';
import { Layers, Loader2 } from 'lucide-react';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    const name = params.get('name');
    const picture = params.get('picture');
    const tenantId = params.get('tenant_id');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setTimeout(() => navigate({ to: '/login' }), 3000);
      return;
    }

    if (!token) {
      setError('No authentication token received');
      setTimeout(() => navigate({ to: '/login' }), 3000);
      return;
    }

    let role = 'admin';
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
      role = payload.role || 'admin';
    } catch {}

    setAuth({
      token,
      tenantId: tenantId || '00000000-0000-0000-0000-000000000001',
      role,
      email: email || undefined,
      name: name || undefined,
      picture: picture || undefined,
      provider: 'google',
    });

    window.history.replaceState({}, '', '/auth/callback');

    navigate({ to: '/app' });
  }, [navigate]);

  return (
    <div className="min-h-full flex items-center justify-center bg-default-50">
      <div className="text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mx-auto mb-6">
          <Layers size={28} />
        </div>
        {error ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Authentication Failed</h1>
            <p className="mt-2 text-sm text-danger">{error}</p>
            <p className="mt-4 text-xs text-default-400">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 size={24} className="animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground">Signing you in...</h1>
            <p className="mt-2 text-sm text-default-500">Please wait while we complete authentication</p>
          </>
        )}
      </div>
    </div>
  );
}
