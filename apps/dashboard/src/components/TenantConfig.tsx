import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TenantSettings {
  id: string;
  slug: string;
  displayName: string;
  budgetLimitUsd: number;
  costAlertThresholds: number[];
  maxConcurrentWorkflows: number;
  maxFixAttempts: number;
  maxReviewAttempts: number;
  defaultModel: string;
  autoMerge: boolean;
  requireGateApproval: boolean;
  allowedRepos: string[];
  webhookSecret?: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchTenants(): Promise<TenantSettings[]> {
  const res = await fetch('/api/tenants');
  if (!res.ok) throw new Error('Failed to fetch tenants');
  return res.json();
}

async function updateTenant(id: string, patch: Partial<TenantSettings>): Promise<TenantSettings> {
  const res = await fetch(`/api/tenants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update tenant');
  return res.json();
}

function TenantCard({ tenant, onSave }: { tenant: TenantSettings; onSave: (id: string, patch: Partial<TenantSettings>) => void }) {
  const [editing, setEditing] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState(String(tenant.budgetLimitUsd));
  const [maxConcurrent, setMaxConcurrent] = useState(String(tenant.maxConcurrentWorkflows));
  const [maxFix, setMaxFix] = useState(String(tenant.maxFixAttempts));
  const [maxReview, setMaxReview] = useState(String(tenant.maxReviewAttempts));
  const [autoMerge, setAutoMerge] = useState(tenant.autoMerge);
  const [requireGate, setRequireGate] = useState(tenant.requireGateApproval);

  const handleSave = () => {
    onSave(tenant.id, {
      budgetLimitUsd: parseFloat(budgetLimit),
      maxConcurrentWorkflows: parseInt(maxConcurrent, 10),
      maxFixAttempts: parseInt(maxFix, 10),
      maxReviewAttempts: parseInt(maxReview, 10),
      autoMerge,
      requireGateApproval: requireGate,
    });
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{tenant.displayName}</h3>
          <p className="text-sm text-gray-500">{tenant.slug}</p>
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
        <Field label="Budget Limit (USD)" value={budgetLimit} onChange={setBudgetLimit} editing={editing} type="number" />
        <Field label="Max Concurrent Workflows" value={maxConcurrent} onChange={setMaxConcurrent} editing={editing} type="number" />
        <Field label="Max Fix Attempts" value={maxFix} onChange={setMaxFix} editing={editing} type="number" />
        <Field label="Max Review Attempts" value={maxReview} onChange={setMaxReview} editing={editing} type="number" />
        <div>
          <p className="text-sm text-gray-500">Auto Merge</p>
          {editing ? (
            <input type="checkbox" checked={autoMerge} onChange={(e) => setAutoMerge(e.target.checked)} />
          ) : (
            <p className="font-medium">{autoMerge ? 'Yes' : 'No'}</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Require Gate Approval</p>
          {editing ? (
            <input type="checkbox" checked={requireGate} onChange={(e) => setRequireGate(e.target.checked)} />
          ) : (
            <p className="font-medium">{requireGate ? 'Yes' : 'No'}</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Default Model</p>
          <p className="font-medium">{tenant.defaultModel}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Allowed Repos</p>
          <p className="font-medium text-sm">{tenant.allowedRepos?.length ? tenant.allowedRepos.join(', ') : 'All'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Cost Alert Thresholds</p>
          <p className="font-medium">{tenant.costAlertThresholds?.map(t => `${t}%`).join(', ') || 'None'}</p>
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
        <input
          type={type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 border rounded text-sm"
        />
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
    queryFn: fetchTenants,
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TenantSettings> }) => updateTenant(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  if (isLoading) return <div className="text-center py-8">Loading tenant configuration...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading tenants</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenant Configuration</h2>
      </div>
      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">Failed to update tenant</div>
      )}
      {data?.map((tenant) => (
        <TenantCard
          key={tenant.id}
          tenant={tenant}
          onSave={(id, patch) => mutation.mutate({ id, patch })}
        />
      )) ?? <div className="text-center py-8 text-gray-500">No tenants configured</div>}
    </div>
  );
}
