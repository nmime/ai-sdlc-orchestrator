import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Button, Chip } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Save, CheckCircle2, XCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface DslRecord {
  id: string;
  name: string;
  version: number;
  definition: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

const DEFAULT_DSL = `name: my-workflow
version: 1
description: Example workflow definition
steps:
  - id: implement
    type: auto
    action: implement
    mode: implement
    description: Implement the feature from the task description
    timeout_minutes: 60
  - id: review
    type: gate
    description: Human review of the implementation
    timeout_minutes: 120
    on_approved: deploy
    on_changes_requested: implement
  - id: deploy
    type: terminal
    description: Deploy the approved changes
    timeout_minutes: 30
`;

export function DslPage() {
  const [yaml, setYaml] = useState(DEFAULT_DSL);
  const [dslName, setDslName] = useState('my-workflow');
  const tenantId = getTenantId();
  const { theme } = useTheme();

  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }, [theme]);

  const { data: dslList, refetch } = useQuery({
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
    onSuccess: () => refetch(),
  });

  const validateMutation = useMutation({
    mutationFn: (dsl: string) =>
      apiFetch<{ valid: boolean; errors: string[] }>(`/tenants/${tenantId}/dsl/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: dsl }),
      }).catch(() => ({ valid: false, errors: ['Validation unavailable'] })),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DSL Editor</h1>
        <p className="text-sm text-default-500 mt-1">Define and validate workflow definitions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between w-full">
                <input
                  type="text"
                  value={dslName}
                  onChange={(e) => setDslName(e.target.value)}
                  placeholder="DSL name"
                  className="px-3 py-1.5 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onPress={() => validateMutation.mutate(yaml)} isDisabled={validateMutation.isPending}>
                    {validateMutation.isPending ? 'Validating...' : 'Validate'}
                  </Button>
                  <Button variant="primary" size="sm" onPress={() => saveMutation.mutate()} isDisabled={saveMutation.isPending}>
                    <Save size={14} className="mr-1" />
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="rounded-xl overflow-hidden border border-divider">
                <Editor
                  height="450px"
                  language="yaml"
                  theme={isDark ? 'vs-dark' : 'light'}
                  value={yaml}
                  onChange={(v) => setYaml(v ?? '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                  }}
                />
              </div>
            </Card.Content>
          </Card>

          {validateMutation.data && (
            <Card>
              <Card.Content>
                {validateMutation.data.valid ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-medium">DSL definition is valid</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-danger mb-2">
                      <XCircle size={16} />
                      <span className="text-sm font-medium">Validation errors</span>
                    </div>
                    <ul className="text-sm text-danger space-y-1 list-disc list-inside">
                      {validateMutation.data.errors?.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </Card.Content>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <Card.Header><Card.Title className="text-sm">Saved DSLs</Card.Title></Card.Header>
            {dslList && dslList.length > 0 ? (
              <div className="divide-y divide-divider">
                {dslList.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.name} <span className="text-default-400">v{d.version}</span></p>
                      <p className="text-xs text-default-400">{new Date(d.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip color={d.isActive ? 'success' : 'default'} variant="soft" size="sm">{d.isActive ? 'Active' : 'Inactive'}</Chip>
                      <Button variant="ghost" size="sm" onPress={() => { setYaml(JSON.stringify(d.definition, null, 2)); setDslName(d.name); }}>Load</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card.Content><p className="text-sm text-default-400 text-center py-4">No DSLs saved yet</p></Card.Content>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
