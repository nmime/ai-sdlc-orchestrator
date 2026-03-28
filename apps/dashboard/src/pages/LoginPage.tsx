import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { setAuth } from '../lib/auth';
import { Layers, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000001');
  const [error, _setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuth({
      token: token || 'dev-dashboard',
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
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Layers size={24} />
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight">Automate your entire software development lifecycle</h2>
          <p className="mt-4 text-white/70 leading-relaxed">From task ticket to reviewed merge request — powered by AI agents in sandboxed environments.</p>
          <div className="mt-8 space-y-3">
            {['Multi-tenant with RBAC', 'Cost control & budgets', 'Provider agnostic', 'Full audit trail'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/80 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                {f}
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
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer token (leave empty for dev mode)"
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
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors">
              Sign in <ArrowRight size={14} />
            </button>
          </form>

          <div className="mt-4">
            <button onClick={handleDevLogin} className="w-full px-4 py-2.5 rounded-lg border border-divider text-sm text-default-600 hover:bg-default-100 transition-colors">
              Quick Dev Login (no auth)
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-default-400">
            <Link to="/" className="hover:text-foreground transition-colors">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
