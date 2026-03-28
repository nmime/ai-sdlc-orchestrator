import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, ProgressBar } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { DollarSign, AlertTriangle, BarChart3, Cpu, Monitor } from 'lucide-react';

interface CostData {
  totalCostUsd: number;
  limitUsd: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  workflowCount: number;
}

export function CostsPage() {
  const tenantId = getTenantId();

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costs', tenantId],
    queryFn: () => apiFetch<CostData>(`/costs/tenants/${tenantId}`),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!costs) return null;

  const usagePercent = costs.limitUsd > 0 ? (costs.totalCostUsd / costs.limitUsd) * 100 : 0;
  const avgCost = costs.workflowCount > 0 ? costs.totalCostUsd / costs.workflowCount : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cost Management</h1>
        <p className="text-sm text-default-500 mt-1">Monitor and control your AI spending</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Monthly Spend" value={`$${costs.totalCostUsd.toFixed(2)}`} sub={`of $${costs.limitUsd.toFixed(0)} limit`} color="primary" />
        <StatCard icon={Cpu} label="AI Cost" value={`$${costs.aiCostUsd.toFixed(2)}`} sub={`${costs.totalCostUsd > 0 ? ((costs.aiCostUsd / costs.totalCostUsd) * 100).toFixed(0) : 0}% of total`} color="accent" />
        <StatCard icon={Monitor} label="Sandbox Cost" value={`$${costs.sandboxCostUsd.toFixed(2)}`} sub={`${costs.totalCostUsd > 0 ? ((costs.sandboxCostUsd / costs.totalCostUsd) * 100).toFixed(0) : 0}% of total`} color="success" />
        <StatCard icon={BarChart3} label="Workflows" value={String(costs.workflowCount)} sub={`avg $${avgCost.toFixed(2)} each`} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Budget Utilization</Card.Title>
            <Card.Description>Monthly budget progress</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground tabular-nums">{usagePercent.toFixed(1)}%</span>
              {usagePercent > 90 && (
                <Chip color="danger" variant="soft" size="sm">
                  <AlertTriangle size={12} className="mr-1" /> Critical
                </Chip>
              )}
              {usagePercent > 70 && usagePercent <= 90 && (
                <Chip color="warning" variant="soft" size="sm">Warning</Chip>
              )}
            </div>
            <ProgressBar value={Math.min(usagePercent, 100)} color={usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'success'}>
              <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
            </ProgressBar>
            <div className="flex justify-between text-sm">
              <span className="text-default-500">$0</span>
              <span className="text-default-500">${costs.limitUsd.toFixed(0)}</span>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Cost Breakdown</Card.Title>
            <Card.Description>Where your money goes</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <CostBar label="AI Provider" value={costs.aiCostUsd} total={costs.totalCostUsd} color="primary" />
            <CostBar label="Sandbox Compute" value={costs.sandboxCostUsd} total={costs.totalCostUsd} color="success" />
            <div className="pt-4 border-t border-divider">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total this month</span>
                <span className="text-lg font-bold text-foreground tabular-nums">${costs.totalCostUsd.toFixed(2)}</span>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Efficiency Metrics</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-xl bg-default-50">
              <p className="text-3xl font-bold text-foreground tabular-nums">{costs.workflowCount}</p>
              <p className="text-sm text-default-500 mt-1">Total Workflows</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-default-50">
              <p className="text-3xl font-bold text-foreground tabular-nums">${avgCost.toFixed(2)}</p>
              <p className="text-sm text-default-500 mt-1">Avg Cost per Workflow</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-default-50">
              <p className="text-3xl font-bold text-foreground tabular-nums">${(costs.limitUsd - costs.totalCostUsd).toFixed(2)}</p>
              <p className="text-sm text-default-500 mt-1">Remaining Budget</p>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

const COLOR_CLASSES: Record<string, { bg: string; text: string; bar: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' },
  success: { bg: 'bg-success/10', text: 'text-success', bar: 'bg-success' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', bar: 'bg-warning' },
  accent: { bg: 'bg-violet-100', text: 'text-violet-600', bar: 'bg-violet-500' },
};

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub: string; color: string }) {
  const c = COLOR_CLASSES[color] ?? { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' };
  return (
    <Card>
      <Card.Content className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-default-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
            <p className="text-xs text-default-400 mt-0.5">{sub}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon size={20} className={c.text} />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

function CostBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const c = COLOR_CLASSES[color] ?? { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-default-600">{label}</span>
        <span className="text-sm font-medium text-foreground tabular-nums">${value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-default-100 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-default-400 mt-0.5">{pct.toFixed(0)}% of total</p>
    </div>
  );
}
