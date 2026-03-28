import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, ProgressBar } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { DollarSign, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

interface CostSummary {
  tenantId: string;
  month: string;
  aiCostUsd: number;
  sandboxCostUsd: number;
  totalCostUsd: number;
  limitUsd: number;
  reservedUsd: number;
  actualUsd: number;
  workflowCount: number;
}

interface RepoCost {
  repoUrl: string;
  totalCostUsd: number;
  workflowCount: number;
}

export function CostsPage() {
  const tenantId = getTenantId();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['cost-summary', tenantId],
    queryFn: () => apiFetch<CostSummary>(`/costs/tenants/${tenantId}`),
    refetchInterval: 30000,
  });

  const { data: repoCosts } = useQuery({
    queryKey: ['cost-by-repo', tenantId],
    queryFn: () => apiFetch<RepoCost[]>(`/costs/tenants/${tenantId}/by-repo`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const usagePercent = summary && summary.limitUsd > 0 ? (summary.totalCostUsd / summary.limitUsd) * 100 : 0;
  const barColor = usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'success';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cost Analytics</h1>
        <p className="text-sm text-default-500 mt-1">Monthly usage for {summary?.month ?? 'current period'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Cost" value={`$${(summary?.totalCostUsd ?? 0).toFixed(2)}`} sub={`of $${(summary?.limitUsd ?? 0).toFixed(0)} limit`} />
        <StatCard icon={TrendingUp} label="AI Cost" value={`$${(summary?.aiCostUsd ?? 0).toFixed(2)}`} sub="LLM inference" />
        <StatCard icon={BarChart3} label="Sandbox Cost" value={`$${(summary?.sandboxCostUsd ?? 0).toFixed(2)}`} sub="Compute time" />
        <StatCard icon={AlertTriangle} label="Workflows" value={String(summary?.workflowCount ?? 0)} sub="this month" />
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between w-full">
            <Card.Title>Budget Usage</Card.Title>
            <Chip color={barColor} variant="soft" size="sm">{usagePercent.toFixed(1)}%</Chip>
          </div>
        </Card.Header>
        <Card.Content>
          <ProgressBar value={Math.min(usagePercent, 100)} color={barColor}>
            <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
          </ProgressBar>
          <div className="flex justify-between text-xs text-default-400 mt-2">
            <span>$0</span>
            <span>${(summary?.limitUsd ?? 0).toFixed(0)}</span>
          </div>
        </Card.Content>
      </Card>

      {repoCosts && repoCosts.length > 0 && (
        <Card>
          <Card.Header><Card.Title>Cost by Repository</Card.Title></Card.Header>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Repository</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Workflows</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {repoCosts.map((r) => (
                  <tr key={r.repoUrl} className="hover:bg-default-50">
                    <td className="px-5 py-3 text-sm text-foreground truncate max-w-[400px]">{r.repoUrl}</td>
                    <td className="px-5 py-3 text-right text-sm text-default-500">{r.workflowCount}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums">${r.totalCostUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <Card.Content className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-default-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-default-400 mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon size={20} className="text-primary" />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
