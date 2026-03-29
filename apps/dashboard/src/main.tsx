import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider, createRouter, createRootRoute, createRoute,
  Outlet, redirect
} from '@tanstack/react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppToaster } from './components/Toast';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { CostsPage } from './pages/CostsPage';
import { GatesPage } from './pages/GatesPage';
import { SessionsPage } from './pages/SessionsPage';
import { DslPage } from './pages/DslPage';
import { SettingsPage } from './pages/SettingsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { UsersPage } from './pages/UsersPage';
import { BillingPage } from './pages/BillingPage';
import { isAuthenticated } from './lib/auth';
import './index.css';

const savedTheme = localStorage.getItem('opwerf_theme') || 'system';
if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 0, refetchOnWindowFocus: false },
  },
});

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});

const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: DashboardLayout,
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' });
  },
});

const overviewRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/', component: OverviewPage });
const workflowsRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/workflows', component: WorkflowsPage });
const workflowDetailRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/workflows/$workflowId', component: WorkflowDetailPage });
const costsRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/costs', component: CostsPage });
const gatesRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/gates', component: GatesPage });
const sessionsRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/sessions', component: SessionsPage });
const dslRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/dsl', component: DslPage });
const settingsRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/settings', component: SettingsPage });
const apiKeysRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/api-keys', component: ApiKeysPage });
const webhooksRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/webhooks', component: WebhooksPage });
const usersRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/users', component: UsersPage });
const billingRoute = createRoute({ getParentRoute: () => dashboardRoute, path: '/billing', component: BillingPage });

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  dashboardRoute.addChildren([
    overviewRoute,
    workflowsRoute,
    workflowDetailRoute,
    costsRoute,
    gatesRoute,
    sessionsRoute,
    dslRoute,
    settingsRoute,
    apiKeysRoute,
    webhooksRoute,
    usersRoute,
    billingRoute,
  ]),
]);

const router = createRouter({ routeTree });

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <AppToaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
