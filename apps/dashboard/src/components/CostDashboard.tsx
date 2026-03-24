import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface CostSummary {
  budgetLimitUsd: number;
  budgetUsedUsd: number;
  aiBudgetUsedUsd: number;
  sandboxBudgetUsedUsd: number;
  remainingUsd: number;
}

interface CostAlert {
  id: string;
  alertType: string;
  thresholdPct: number;
  actualUsd: number;
  limitUsd: number;
  acknowledged: boolean;
  createdAt: string;
}

interface DailyCost {
  date: string;
  aiCost: number;
  sandboxCost: number;
  total: number;
}

async function fetchCostSummary(tenantId: string): Promise<CostSummary> {
  const res = await fetch(`/api/costs/summary/${tenantId}`);
  if (!res.ok) throw new Error('Failed to fetch costs');
  return res.json();
}

async function fetchCostAlerts(tenantId: string): Promise<CostAlert[]> {
  const res = await fetch(`/api/costs/alerts/${tenantId}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

async function fetchDailyCosts(tenantId: string): Promise<DailyCost[]> {
  const res = await fetch(`/api/costs/daily/${tenantId}`);
  if (!res.ok) throw new Error('Failed to fetch daily costs');
  return res.json();
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981'];

export function CostDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['costs', 'default'],
    queryFn: () => fetchCostSummary('default'),
    refetchInterval: 10000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['cost-alerts', 'default'],
    queryFn: () => fetchCostAlerts('default'),
    refetchInterval: 30000,
  });

  const { data: dailyCosts } = useQuery({
    queryKey: ['daily-costs', 'default'],
    queryFn: () => fetchDailyCosts('default'),
  });

  if (isLoading) return <div className="text-center py-8">Loading cost data...</div>;
  if (!data) return <div className="text-center py-8 text-gray-500">No cost data available</div>;

  const budgetPct = data.budgetLimitUsd > 0 ? (Number(data.budgetUsedUsd) / Number(data.budgetLimitUsd)) * 100 : 0;

  const pieData = [
    { name: 'AI Cost', value: Number(data.aiBudgetUsedUsd) },
    { name: 'Sandbox Cost', value: Number(data.sandboxBudgetUsedUsd) },
    { name: 'Remaining', value: data.remainingUsd },
  ];

  const barData = [
    { name: 'Budget Limit', value: Number(data.budgetLimitUsd) },
    { name: 'Total Used', value: Number(data.budgetUsedUsd) },
    { name: 'AI Used', value: Number(data.aiBudgetUsedUsd) },
    { name: 'Sandbox Used', value: Number(data.sandboxBudgetUsedUsd) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Budget Limit', value: `$${Number(data.budgetLimitUsd).toFixed(2)}`, color: 'text-gray-900' },
          { label: 'Total Used', value: `$${Number(data.budgetUsedUsd).toFixed(2)}`, color: 'text-indigo-600' },
          { label: 'AI Cost', value: `$${Number(data.aiBudgetUsedUsd).toFixed(2)}`, color: 'text-amber-600' },
          { label: 'Remaining', value: `$${data.remainingUsd.toFixed(2)}`, color: 'text-green-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold mb-2">Budget Utilization</h3>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{budgetPct.toFixed(1)}% used</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold mb-4">Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold mb-4">Budget Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dailyCosts && dailyCosts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold mb-4">Daily Cost Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyCosts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="aiCost" stroke="#6366f1" name="AI Cost" />
              <Line type="monotone" dataKey="sandboxCost" stroke="#f59e0b" name="Sandbox Cost" />
              <Line type="monotone" dataKey="total" stroke="#10b981" name="Total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Cost Alerts</h3>
        </div>
        {alerts && alerts.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Threshold</th>
                <th className="px-4 py-2">Actual</th>
                <th className="px-4 py-2">Limit</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {alerts.map((alert) => (
                <tr key={alert.id} className="text-sm">
                  <td className="px-4 py-2 font-medium">{alert.alertType}</td>
                  <td className="px-4 py-2">{alert.thresholdPct}%</td>
                  <td className="px-4 py-2">${Number(alert.actualUsd).toFixed(2)}</td>
                  <td className="px-4 py-2">${Number(alert.limitUsd).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      alert.acknowledged ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
                    }`}>
                      {alert.acknowledged ? 'Acknowledged' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(alert.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">No cost alerts</div>
        )}
      </div>
    </div>
  );
}
