import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card, Chip, Spinner, ProgressBar } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import {
  GitBranch, DollarSign, ShieldCheck, Activity, ArrowRight,
  Webhook, Key, FileCode, Terminal, Rocket, ExternalLink, Clock
} from 'lucide-react';

export function OverviewPage() {
  const tenantId = getTenantId();

  const { data: workflows, isLoading: wfLoading } = useQuery({
    queryKey: ['overview-workflows'],
    queryFn: () => apiFetch<{ data: { id: string; status: string; taskTitle: string; totalCostUsd: number; startedAt: string }[]; total: number }>('/workflows?limit=5'),
    refetchInterval: 10000,
  });

  const { data: costs } = useQuery({
    queryKey: ['overview-costs', tenantId],
    queryFn: () => apiFetch<{ totalCostUsd: number; limitUsd: number; aiCostUsd: number; sandboxCostUsd: number; workflowCount: number }>(`/costs/tenants/${tenantId}`),
  });

  const { data: gates } = useQuery({
    queryKey: ['overview-gates'],
    queryFn: () => apiFetch<{ data: { id: string }[] }>('/workflows?status=awaiting_gate'),
  });

  const usagePercent = costs && costs.limitUsd > 0 ? (costs.totalCostUsd / costs.limitUsd) * 100 : 0;
  const runningCount = workflows?.data?.filter(w => w.status === 'running').length ?? 0;
  const hasWorkflows = (workflows?.total ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-default-500 mt-1">Overview of your Opwerf platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GitBranch} label="Total Workflows" value={String(workflows?.total ?? 0)} color="primary" sub={`${runningCount} running`} />
        <StatCard icon={DollarSign} label="Monthly Cost" value={`$${(costs?.totalCostUsd ?? 0).toFixed(2)}`} color="success" sub={`of $${(costs?.limitUsd ?? 0).toFixed(0)} limit`} />
        <StatCard icon={ShieldCheck} label="Pending Gates" value={String(gates?.data?.length ?? 0)} color="warning" sub="awaiting approval" />
        <StatCard icon={Activity} label="AI Cost" value={`$${(costs?.aiCostUsd ?? 0).toFixed(2)}`} color="accent" sub="this month" />
      </div>

      {!wfLoading && !hasWorkflows && (
        <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
          <Card.Content className="py-8">
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Rocket size={28} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground">Welcome to Opwerf</h2>
                <p className="text-sm text-default-500 mt-1">Get started by completing these steps to run your first AI-powered workflow.</p>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SetupStep
                    step={1}
                    icon={Key}
                    title="Create an API Key"
                    description="Generate credentials for API access"
                    to="/app/api-keys"
                  />
                  <SetupStep
                    step={2}
                    icon={Webhook}
                    title="Configure Webhooks"
                    description="Connect your Git provider"
                    to="/app/webhooks"
                  />
                  <SetupStep
                    step={3}
                    icon={FileCode}
                    title="Define a Workflow DSL"
                    description="Create your pipeline definition"
                    to="/app/dsl"
                  />
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between w-full">
                <Card.Title>Recent Workflows</Card.Title>
                {hasWorkflows && (
                  <Link to="/app/workflows" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                )}
              </div>
            </Card.Header>
            {wfLoading ? (
              <Card.Content><div className="flex justify-center py-8"><Spinner /></div></Card.Content>
            ) : (
              <div className="divide-y divide-divider">
                {(workflows?.data ?? []).map((wf) => (
                  <Link
                    key={wf.id}
                    to="/app/workflows/$workflowId"
                    params={{ workflowId: wf.id }}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-default-50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{wf.taskTitle}</p>
                      <p className="text-xs text-default-400 mt-0.5">{new Date(wf.startedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusChip status={wf.status} />
                      <span className="text-xs font-medium text-default-600 tabular-nums">${(wf.totalCostUsd ?? 0).toFixed(2)}</span>
                      <ExternalLink size={14} className="text-default-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
                {(workflows?.data ?? []).length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <Terminal size={32} className="mx-auto text-default-200 mb-3" />
                    <p className="text-sm text-default-400">No workflows yet. Create one via webhook or API.</p>
                    <Link to="/app/webhooks" className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
                      Set up webhooks <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <Card.Header>
              <Card.Title>Budget Usage</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Monthly budget</span>
                <span className="text-sm font-medium">{usagePercent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={Math.min(usagePercent, 100)} color={usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'success'}>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-default-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-default-400 uppercase">AI</p>
                  <p className="text-sm font-medium">${(costs?.aiCostUsd ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-default-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-default-400 uppercase">Sandbox</p>
                  <p className="text-sm font-medium">${(costs?.sandboxCostUsd ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header><Card.Title>Quick Stats</Card.Title></Card.Header>
            <Card.Content className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Workflows this month</span>
                <span className="text-sm font-medium">{costs?.workflowCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Avg cost/workflow</span>
                <span className="text-sm font-medium">${costs && costs.workflowCount > 0 ? (costs.totalCostUsd / costs.workflowCount).toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Remaining budget</span>
                <span className="text-sm font-medium">${((costs?.limitUsd ?? 0) - (costs?.totalCostUsd ?? 0)).toFixed(2)}</span>
              </div>
            </Card.Content>
          </Card>

          {(gates?.data?.length ?? 0) > 0 && (
            <Card className="border-l-4 border-warning">
              <Card.Content className="py-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-warning flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{gates?.data?.length} gate{(gates?.data?.length ?? 0) !== 1 ? 's' : ''} awaiting approval</p>
                    <Link to="/app/gates" className="text-xs text-primary hover:underline">Review now</Link>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}

          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

function SetupStep({ step, icon: Icon, title, description, to }: { step: number; icon: React.ElementType; title: string; description: string; to: string }) {
  return (
    <Link to={to} className="flex items-start gap-3 p-4 rounded-xl bg-background border border-divider hover:border-primary/50 hover:shadow-sm transition-all group">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-default-400 font-medium">Step {step}</p>
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-default-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

const STATUS_MAP: Record<string, { color: 'default' | 'accent' | 'success' | 'warning' | 'danger'; label: string }> = {
  queued: { color: 'default', label: 'Queued' },
  running: { color: 'accent', label: 'Running' },
  awaiting_gate: { color: 'warning', label: 'Awaiting Gate' },
  awaiting_ci: { color: 'warning', label: 'Awaiting CI' },
  completed: { color: 'success', label: 'Completed' },
  failed: { color: 'danger', label: 'Failed' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

function StatusChip({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { color: 'default' as const, label: status };
  return <Chip color={info.color} variant="soft" size="sm">{info.label}</Chip>;
}

const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  success: { bg: 'bg-success/10', text: 'text-success' },
  warning: { bg: 'bg-warning/10', text: 'text-warning' },
  danger: { bg: 'bg-danger/10', text: 'text-danger' },
  accent: { bg: 'bg-violet-100', text: 'text-violet-600' },
};

function StatCard({ icon: Icon, label, value, color, sub }: { icon: React.ElementType; label: string; value: string; color: string; sub?: string }) {
  const c = COLOR_CLASSES[color] ?? { bg: 'bg-primary/10', text: 'text-primary' };
  return (
    <Card>
      <Card.Content className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-default-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-default-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon size={20} className={c.text} />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

function ActivityFeed() {
  const { data: workflows } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => apiFetch<{ data: { id: string; status: string; taskTitle: string; startedAt: string; updatedAt?: string }[] }>('/workflows?limit=10'),
    refetchInterval: 15000,
  });

  const activities = (workflows?.data ?? []).flatMap(wf => {
    const items = [];
    items.push({
      id: `${wf.id}-created`,
      message: `Workflow "${wf.taskTitle}" created`,
      time: wf.startedAt,
      type: 'create' as const,
    });
    if (wf.status === 'completed' || wf.status === 'failed') {
      items.push({
        id: `${wf.id}-${wf.status}`,
        message: `Workflow "${wf.taskTitle}" ${wf.status}`,
        time: wf.updatedAt ?? wf.startedAt,
        type: wf.status as 'completed' | 'failed',
      });
    }
    return items;
  }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  const typeColor: Record<string, string> = {
    create: 'bg-primary',
    completed: 'bg-success',
    failed: 'bg-danger',
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <Card.Title>Activity Feed</Card.Title>
        </div>
      </Card.Header>
      <Card.Content>
        {activities.length === 0 ? (
          <p className="text-sm text-default-400 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeColor[a.type] ?? 'bg-default-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-default-600 truncate">{a.message}</p>
                  <p className="text-[10px] text-default-400 flex items-center gap-1 mt-0.5">
                    <Clock size={10} />{new Date(a.time).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
