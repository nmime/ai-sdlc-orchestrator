import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: string;
  maxConcurrentWorkflows: number;
  maxConcurrentSandboxes: number;
  monthlyCostLimitUsd: number;
  monthlyCostActualUsd: number;
  monthlyAiCostActualUsd: number;
  monthlySandboxCostActualUsd: number;
  defaultAgentProvider?: string;
  defaultAgentModel?: string;
  mcpServerPolicy: string;
  costAlertThresholds?: number[];
  sandboxHourlyRateUsd: number;
  createdAt: string;
  updatedAt: string;
}

function TenantCard({ tenant, onSave }: { tenant: TenantData; onSave: (id: string, patch: Partial<TenantData>) => void }) {
  const [editing, setEditing] = useState(false);
  const [costLimit, setCostLimit] = useState(String(tenant.monthlyCostLimitUsd));
  const [maxConcurrent, setMaxConcurrent] = useState(String(tenant.maxConcurrentWorkflows));
  const [maxSandboxes, setMaxSandboxes] = useState(String(tenant.maxConcurrentSandboxes));
  const [mcpPolicy, setMcpPolicy] = useState(tenant.mcpServerPolicy);

  const handleSave = () => {
    onSave(tenant.id, {
      monthlyCostLimitUsd: parseFloat(costLimit),
      maxConcurrentWorkflows: parseInt(maxConcurrent, 10),
      maxConcurrentSandboxes: parseInt(maxSandboxes, 10),
      mcpServerPolicy: mcpPolicy,
    } as Partial<TenantData>);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{tenant.name}</h3>
          <p className="text-sm text-gray-500">{tenant.slug} &middot; <span className={`px-1.5 py-0.5 rounded text-xs ${tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{tenant.status}</span></p>
        </div>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            editing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
          }`}
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monthly Cost Limit (USD)" value={costLimit} onChange={setCostLimit} editing={editing} type="number" />
        <Field label="Max Concurrent Workflows" value={maxConcurrent} onChange={setMaxConcurrent} editing={editing} type="number" />
        <Field label="Max Concurrent Sandboxes" value={maxSandboxes} onChange={setMaxSandboxes} editing={editing} type="number" />
        <div>
          <p className="text-sm text-gray-500">MCP Server Policy</p>
          {editing ? (
            <select value={mcpPolicy} onChange={(e) => setMcpPolicy(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
              <option value="curated">Curated</option>
              <option value="open">Open</option>
            </select>
          ) : (
            <p className="font-medium">{tenant.mcpServerPolicy}</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Actual Monthly Cost</p>
          <p className="font-medium">${Number(tenant.monthlyCostActualUsd).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">AI Cost (Month)</p>
          <p className="font-medium">${Number(tenant.monthlyAiCostActualUsd).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Sandbox Cost (Month)</p>
          <p className="font-medium">${Number(tenant.monthlySandboxCostActualUsd).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Default Agent</p>
          <p className="font-medium text-sm">{tenant.defaultAgentProvider ? `${tenant.defaultAgentProvider}/${tenant.defaultAgentModel}` : 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Cost Alert Thresholds</p>
          <p className="font-medium">{tenant.costAlertThresholds?.map(t => `${t}%`).join(', ') || 'None'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Sandbox Rate</p>
          <p className="font-medium">${Number(tenant.sandboxHourlyRateUsd).toFixed(2)}/hr</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Created</p>
          <p className="font-medium text-sm">{new Date(tenant.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, editing, type }: {
  label: string; value: string; onChange: (v: string) => void; editing: boolean; type?: string;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      {editing ? (
        <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
      ) : (
        <p className="font-medium">{value}</p>
      )}
    </div>
  );
}

export function TenantConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<TenantData[]>('/tenants'),
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TenantData> }) =>
      apiFetch(`/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  if (isLoading) return <div className="text-center py-8">Loading tenant configuration...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error: {(error as Error).message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenant Configuration</h2>
      </div>
      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">Failed to update tenant</div>
      )}
      {data && data.length > 0 ? data.map((tenant) => (
        <TenantCard key={tenant.id} tenant={tenant} onSave={(id, patch) => mutation.mutate({ id, patch })} />
      )) : <div className="text-center py-8 text-gray-500">No tenants configured</div>}
    </div>
  );
}
