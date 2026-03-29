import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { setAuth } from '../lib/auth';
import { Layers, ArrowRight, Shield, Cpu, GitBranch, DollarSign } from 'lucide-react';

const FEATURES = [
  { icon: GitBranch, title: 'Multi-tenant with RBAC', description: 'Isolated tenants with role-based access control' },
  { icon: DollarSign, title: 'Cost control & budgets', description: 'Set monthly limits and track spending per workflow' },
  { icon: Cpu, title: 'Provider agnostic', description: 'Works with any AI model — Claude, GPT, Gemini, and more' },
  { icon: Shield, title: 'Full audit trail', description: 'Every action logged and traceable end-to-end' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000001');
  const [error, _setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      _setError('API token is required');
      return;
    }
    setLoading(true);
    _setError('');
    setAuth({
      token,
      tenantId,
      role: 'admin',
      email: 'admin@local',
    });
    navigate({ to: '/app' });
  };

  const handleDevLogin = () => {
    setAuth({
      token: 'dev-dashboard',
      tenantId: '00000000-0000-0000-0000-000000000001',
      role: 'admin',
      email: 'dev@local',
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
              <h1 className="text-xl font-bold">AI SDLC</h1>
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
            <span className="font-bold text-foreground">AI SDLC Orchestrator</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-default-500">Enter your API credentials to access the dashboard</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">API Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => { setToken(e.target.value); _setError(''); }}
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
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'} {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-4">
              <button onClick={handleDevLogin} className="w-full px-4 py-2.5 rounded-lg border border-dashed border-divider text-sm text-default-600 hover:bg-default-100 hover:border-primary/30 transition-colors">
                Quick Dev Login (no auth)
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-divider flex items-center justify-between">
            <Link to="/" className="text-xs text-default-400 hover:text-foreground transition-colors">Back to home</Link>
            <span className="text-xs text-default-300">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
