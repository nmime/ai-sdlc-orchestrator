import { useState } from 'react';
import { Outlet, Link, useRouterState } from '@tanstack/react-router';
import { clearAuth, getAuth } from '../lib/auth';
import {
  LayoutDashboard, GitBranch, DollarSign, ShieldCheck,
  Monitor, FileCode, Settings, Key, Webhook, LogOut,
  ChevronLeft, ChevronRight, Layers
} from 'lucide-react';
import { cn } from '../lib/cn';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/app/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/app/costs', icon: DollarSign, label: 'Costs' },
  { to: '/app/gates', icon: ShieldCheck, label: 'Gates' },
  { to: '/app/sessions', icon: Monitor, label: 'Sessions' },
  { to: '/app/dsl', icon: FileCode, label: 'DSL Editor' },
  { to: '/app/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/app/api-keys', icon: Key, label: 'API Keys' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
];

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const auth = getAuth();

  return (
    <div className="h-full flex bg-default-50">
      <aside className={cn(
        'h-full flex flex-col border-r border-divider bg-background transition-all duration-200',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-divider flex-shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white flex-shrink-0">
            <Layers size={18} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">AI SDLC</h1>
              <p className="text-[10px] text-default-400 truncate">Orchestrator</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? currentPath === '/app' || currentPath === '/app/'
              : currentPath.startsWith(item.to) && item.to !== '/app';
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-default-600 hover:bg-default-100 hover:text-foreground'
                )}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-divider p-2 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-default-500 hover:bg-default-100 w-full"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={() => { clearAuth(); window.location.hash = '#/login'; }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 w-full"
          >
            <LogOut size={18} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-divider bg-background px-6 flex items-center justify-between flex-shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs text-default-500">{auth?.email || 'dev@local'}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1400px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
