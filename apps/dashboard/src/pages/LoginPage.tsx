import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { setAuth, isAuthenticated } from '../lib/auth';
import { Layers, ArrowRight, Shield, Cpu, GitBranch, DollarSign, Loader2 } from 'lucide-react';

const FEATURES = [
  { icon: GitBranch, title: 'Multi-tenant with RBAC', description: 'Isolated tenants with role-based access control' },
  { icon: DollarSign, title: 'Cost control & budgets', description: 'Set monthly limits and track spending per workflow' },
  { icon: Cpu, title: 'Provider agnostic', description: 'Works with any AI model — Claude, GPT, Gemini, and more' },
  { icon: Shield, title: 'Full audit trail', description: 'Every action logged and traceable end-to-end' },
];

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [showApiLogin, setShowApiLogin] = useState(false);
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000001');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate({ to: '/app' });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam).replace(/_/g, ' '));
      window.history.replaceState({}, '', '/login');
    }

    fetch('/auth/health')
      .then(r => r.json())
      .then(data => setGoogleConfigured(data.google === true))
      .catch(() => setGoogleConfigured(false));
  }, [navigate]);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setError('');
    window.location.href = '/auth/google';
  };

  const handleApiLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('API token is required');
      return;
    }
    setLoading(true);
    setError('');
    setAuth({
      token,
      tenantId,
      role: 'admin',
      email: 'api-user@local',
      provider: 'api-key',
    });
    navigate({ to: '/app' });
  };

  const handleDevLogin = () => {
    setAuth({
      token: 'dev-dashboard',
      tenantId: '00000000-0000-0000-0000-000000000001',
      role: 'admin',
      email: 'dev@local',
      provider: 'dev',
    });
    navigate({ to: '/app' });
  };

  return (
    <div className="min-h-full flex bg-default-50">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Opwerf</h1>
              <p className="text-white/60 text-xs">Orchestrator</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight">Automate your entire software development lifecycle</h2>
          <p className="mt-4 text-white/70 leading-relaxed">From task ticket to reviewed merge request — powered by AI agents in sandboxed environments.</p>
          <div className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <f.icon size={18} className="text-white/90" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs text-white/60 mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center">
              <Layers size={18} />
            </div>
            <span className="font-bold text-foreground">Opwerf</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-default-500">Choose your preferred authentication method</p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {googleConfigured !== false && (
              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading || googleConfigured === null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-divider bg-background text-foreground text-sm font-medium hover:bg-default-50 hover:border-default-400 transition-all disabled:opacity-50 shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>
            )}

            {googleConfigured === false && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-warning font-medium">Google OAuth not configured</p>
                <p className="text-xs text-default-500 mt-1">
                  Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables on the auth server.
                  Use the API token or dev mode login below instead.
                </p>
              </div>
            )}

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-divider" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-default-50 px-3 text-default-400">or</span>
              </div>
            </div>

            {!showApiLogin ? (
              <button
                onClick={() => setShowApiLogin(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-divider text-sm text-default-600 hover:bg-default-100 hover:border-default-400 transition-all"
              >
                Sign in with API Token
              </button>
            ) : (
              <form onSubmit={handleApiLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">API Token</label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => { setToken(e.target.value); setError(''); }}
                    placeholder="Bearer token"
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 rounded-lg border border-divider bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tenant ID</label>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000001"
                    className="w-full px-4 py-2.5 rounded-lg border border-divider bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in with Token'} {!loading && <ArrowRight size={14} />}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6">
            <p className="text-xs text-default-400 text-center mb-2">Development & Testing</p>
            <button onClick={handleDevLogin} className="w-full px-4 py-2.5 rounded-lg border border-dashed border-divider text-sm text-default-600 hover:bg-default-100 hover:border-primary/30 transition-colors">
              Dev Mode (no auth required)
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-divider flex items-center justify-between">
            <Link to="/" className="text-xs text-default-400 hover:text-foreground transition-colors">Back to home</Link>
            <span className="text-xs text-default-300">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
