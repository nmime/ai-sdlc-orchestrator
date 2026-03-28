import { useQuery } from '@tanstack/react-query';
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

  if (isLoading) return <div className="text-center py-8">Loading cost data...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error: {(error as Error).message}</div>;

  const usagePercent = summary && summary.limitUsd > 0 ? (summary.totalCostUsd / summary.limitUsd) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Cost" value={`$${(summary?.totalCostUsd ?? 0).toFixed(2)}`} sub={`of $${(summary?.limitUsd ?? 0).toFixed(0)} limit`} />
        <StatCard label="AI Cost" value={`$${(summary?.aiCostUsd ?? 0).toFixed(2)}`} />
        <StatCard label="Sandbox Cost" value={`$${(summary?.sandboxCostUsd ?? 0).toFixed(2)}`} />
        <StatCard label="Workflows" value={String(summary?.workflowCount ?? 0)} sub={summary?.month} />
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold mb-3">Budget Usage</h3>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{usagePercent.toFixed(1)}% used</p>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Cost Alerts</h3>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-yellow-700">Threshold {a.threshold}% reached ({a.currentUsage.toFixed(1)}%)</span>
                <span className="text-xs text-yellow-600">{new Date(a.alertedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {repoCosts && repoCosts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold mb-3">Cost by Repository</h3>
          <div className="divide-y">
            {repoCosts.map((r) => (
              <div key={r.repoUrl} className="flex justify-between py-2">
                <span className="text-sm text-gray-700 truncate">{r.repoUrl}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">{r.workflowCount} workflows</span>
                  <span className="font-medium">${r.totalCostUsd.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
