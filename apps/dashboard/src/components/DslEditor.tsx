import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface DslRecord {
  id: string;
  name: string;
  version: number;
  definition: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
}

const DEFAULT_DSL = `name: my-workflow
version: "1.0"
steps:
  - id: implement
    agent: coder
    prompt: "Implement the feature"
    maxTokens: 4000
  - id: review
    agent: reviewer
    prompt: "Review the implementation"
    dependsOn:
      - implement
  - id: gate
    type: approval
    approvers:
      - team-lead
    dependsOn:
      - review
`;

export function DslEditor() {
  const [yaml, setYaml] = useState(DEFAULT_DSL);
  const [dslName, setDslName] = useState('my-workflow');
  const tenantId = localStorage.getItem('tenant_id') || '00000000-0000-0000-0000-000000000001';

  const { data: dslList, refetch: refetchDsl } = useQuery({
    queryKey: ['dsl-list', tenantId],
    queryFn: () => apiFetch<DslRecord[]>(`/tenants/${tenantId}/dsl`),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<DslRecord>(`/tenants/${tenantId}/dsl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dslName, definition: { raw: yaml } }),
      }),
    onSuccess: () => refetchDsl(),
  });

  const validateMutation = useMutation({
    mutationFn: (dsl: string) =>
      apiFetch<{ valid: boolean; errors: string[] }>(`/tenants/${tenantId}/dsl/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: dsl }),
      }).catch(() => ({ valid: false, errors: ['Server validation unavailable'] })),
  });

  const { data: workflows } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?limit=10'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">DSL Editor</h2>
            <div className="flex gap-2">
              <button
                onClick={() => validateMutation.mutate(yaml)}
                disabled={validateMutation.isPending}
                className="px-3 py-1.5 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                {validateMutation.isPending ? 'Validating...' : 'Validate'}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save DSL'}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={dslName}
            onChange={(e) => setDslName(e.target.value)}
            placeholder="DSL name"
            className="w-full px-3 py-1.5 border rounded-md text-sm"
          />
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-96 font-mono text-sm p-4 bg-gray-900 text-green-400 rounded-lg border-0 resize-none focus:ring-2 focus:ring-indigo-500"
            spellCheck={false}
          />
          {validateMutation.data && (
            <div className={`rounded-md p-3 ${
              validateMutation.data.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {validateMutation.data.valid ? (
                <p className="text-sm text-green-700">DSL is valid</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-700">Validation errors:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {validateMutation.data.errors?.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {saveMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-700">DSL saved successfully</p>
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">Failed to save DSL: {(saveMutation.error as Error).message}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Saved DSLs</h2>
            <div className="bg-white rounded-lg shadow">
              {dslList && dslList.length > 0 ? (
                <div className="divide-y">
                  {dslList.map((d) => (
                    <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{d.name} <span className="text-xs text-gray-400">v{d.version}</span></p>
                        <p className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {d.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => { setYaml(JSON.stringify(d.definition, null, 2)); setDslName(d.name); }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">No DSLs saved yet</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Workflows</h2>
            <div className="bg-white rounded-lg shadow">
              {workflows?.data && workflows.data.length > 0 ? (
                <div className="divide-y">
                  {workflows.data.map((wf) => (
                    <div key={wf.id} className="px-4 py-3 flex items-center justify-between">
                      <p className="text-sm font-medium">{wf.taskTitle || wf.id.slice(0, 8)}</p>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        wf.status === 'completed' ? 'bg-green-100 text-green-700' :
                        wf.status === 'running' ? 'bg-blue-100 text-blue-700' :
                        wf.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {wf.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">No workflows yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
