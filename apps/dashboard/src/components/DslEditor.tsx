import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface WorkflowStep {
  id: string;
  name: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

interface WorkflowTimeline {
  workflowId: string;
  dslName: string;
  steps: WorkflowStep[];
}

async function validateDsl(yaml: string): Promise<ValidationResult> {
  const res = await fetch('/api/dsl/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml }),
  });
  if (!res.ok) throw new Error('Validation request failed');
  return res.json();
}

async function fetchWorkflowTimeline(workflowId: string): Promise<WorkflowTimeline> {
  const res = await fetch(`/api/workflows/${workflowId}/timeline`);
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

async function fetchRecentWorkflowIds(): Promise<{ items: { id: string; dslName: string; state: string }[] }> {
  const res = await fetch('/api/workflows?limit=10');
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
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

const stepStatusColors: Record<string, string> = {
  pending: 'bg-gray-200',
  running: 'bg-blue-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  skipped: 'bg-gray-300',
};

export function DslEditor() {
  const [yaml, setYaml] = useState(DEFAULT_DSL);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const validation = useMutation({
    mutationFn: validateDsl,
  });

  const { data: workflows } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: fetchRecentWorkflowIds,
  });

  const { data: timeline } = useQuery({
    queryKey: ['workflow-timeline', selectedWorkflowId],
    queryFn: () => fetchWorkflowTimeline(selectedWorkflowId!),
    enabled: !!selectedWorkflowId,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">DSL Editor</h2>
            <button
              onClick={() => validation.mutate(yaml)}
              disabled={validation.isPending}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {validation.isPending ? 'Validating...' : 'Validate'}
            </button>
          </div>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-96 font-mono text-sm p-4 bg-gray-900 text-green-400 rounded-lg border-0 resize-none focus:ring-2 focus:ring-indigo-500"
            spellCheck={false}
          />
          {validation.data && (
            <div className={`rounded-md p-3 ${
              validation.data.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {validation.data.valid ? (
                <p className="text-sm text-green-700">DSL is valid</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-700">Validation errors:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {validation.data.errors?.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {validation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              Failed to validate DSL
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow Timeline</h2>
            <select
              value={selectedWorkflowId ?? ''}
              onChange={(e) => setSelectedWorkflowId(e.target.value || null)}
              className="px-2 py-1.5 border rounded-md text-sm"
            >
              <option value="">Select workflow...</option>
              {workflows?.items.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.dslName || wf.id.slice(0, 8)} ({wf.state})
                </option>
              ))}
            </select>
          </div>

          {timeline ? (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold mb-3">{timeline.dslName}</h3>
              <div className="space-y-2">
                {timeline.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${stepStatusColors[step.status] || 'bg-gray-200'}`} />
                      {i < timeline.steps.length - 1 && <div className="w-0.5 h-6 bg-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{step.name || step.id}</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          step.status === 'completed' ? 'bg-green-100 text-green-700' :
                          step.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          step.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {step.status}
                        </span>
                      </div>
                      {step.startedAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(step.startedAt).toLocaleTimeString()}
                          {step.completedAt && ` — ${new Date(step.completedAt).toLocaleTimeString()}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
              Select a workflow to view its step timeline
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
