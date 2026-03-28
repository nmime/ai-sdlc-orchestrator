import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, ProgressBar } from '@heroui/react';
import { apiFetch } from '../lib/api';

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

interface CostAlert {
  id: string;
  threshold: number;
  currentUsage: number;
  alertedAt: string;
}

interface RepoCost {
  repoUrl: string;
  totalCostUsd: number;
  workflowCount: number;
}

export function CostDashboard() {
  const tenantId = localStorage.getItem('tenant_id') || '00000000-0000-0000-0000-000000000001';

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['cost-summary', tenantId],
    queryFn: () => apiFetch<CostSummary>(`/costs/tenants/${tenantId}`),
    refetchInterval: 30000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['cost-alerts', tenantId],
    queryFn: () => apiFetch<CostAlert[]>(`/costs/tenants/${tenantId}/alerts`),
  });

  const { data: repoCosts } = useQuery({
    queryKey: ['cost-by-repo', tenantId],
    queryFn: () => apiFetch<RepoCost[]>(`/costs/tenants/${tenantId}/by-repo`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <Card><Card.Content><p className="text-danger text-sm">Error: {(error as Error).message}</p></Card.Content></Card>;

  const usagePercent = summary && summary.limitUsd > 0 ? (summary.totalCostUsd / summary.limitUsd) * 100 : 0;
  const barColor = usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'success';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Cost Analytics</h2>
        <p className="text-sm text-default-500">Monthly usage for {summary?.month ?? 'current period'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Cost" value={`$${(summary?.totalCostUsd ?? 0).toFixed(2)}`} sub={`of $${(summary?.limitUsd ?? 0).toFixed(0)} limit`} />
        <StatCard label="AI Cost" value={`$${(summary?.aiCostUsd ?? 0).toFixed(2)}`} sub="LLM inference" />
        <StatCard label="Sandbox Cost" value={`$${(summary?.sandboxCostUsd ?? 0).toFixed(2)}`} sub="Compute time" />
        <StatCard label="Workflows" value={String(summary?.workflowCount ?? 0)} sub={summary?.month} />
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between w-full">
            <Card.Title>Budget Usage</Card.Title>
            <Chip color={barColor} variant="soft" size="sm">
              {usagePercent.toFixed(1)}%
            </Chip>
          </div>
        </Card.Header>
        <Card.Content>
          <ProgressBar value={Math.min(usagePercent, 100)} color={barColor}>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <div className="flex justify-between text-xs text-default-400 mt-2">
            <span>$0</span>
            <span>${(summary?.limitUsd ?? 0).toFixed(0)}</span>
          </div>
        </Card.Content>
      </Card>

      {alerts && alerts.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Cost Alerts</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Chip color="warning" variant="soft" size="sm">{a.threshold}%</Chip>
                    <span className="text-sm text-default-600">Threshold reached ({a.currentUsage.toFixed(1)}% usage)</span>
                  </div>
                  <span className="text-xs text-default-400">{new Date(a.alertedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {repoCosts && repoCosts.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Cost by Repository</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="divide-y divide-divider">
              {repoCosts.map((r) => (
                <div key={r.repoUrl} className="flex items-center justify-between py-3">
                  <span className="text-sm text-default-700 truncate flex-1 mr-4">{r.repoUrl}</span>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-default-500">{r.workflowCount} workflows</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">${r.totalCostUsd.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <Card.Content className="pt-5">
        <p className="text-xs text-default-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-default-400 mt-0.5">{sub}</p>}
      </Card.Content>
    </Card>
  );
}
