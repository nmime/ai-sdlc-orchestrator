import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface CostSummary {
  budgetLimitUsd: number;
  budgetUsedUsd: number;
  aiBudgetUsedUsd: number;
  sandboxBudgetUsedUsd: number;
  remainingUsd: number;
}

async function fetchCostSummary(tenantId: string): Promise<CostSummary> {
  const res = await fetch(`/api/costs/summary/${tenantId}`);
  if (!res.ok) throw new Error('Failed to fetch costs');
  return res.json();
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981'];

export function CostDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['costs', 'default'],
    queryFn: () => fetchCostSummary('default'),
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="text-center py-8">Loading cost data...</div>;
  if (!data) return <div className="text-center py-8 text-gray-500">No cost data available</div>;

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
    </div>
  );
}
