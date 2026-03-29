import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip, Spinner, EmptyState } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { Key, Plus, Trash2, Copy } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ApiKeysPage() {
  const tenantId = getTenantId();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys', tenantId],
    queryFn: () => apiFetch<ApiKey[]>(`/tenants/${tenantId}/api-keys`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch<{ key: string }>(`/tenants/${tenantId}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role }),
    }),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => apiFetch(`/tenants/${tenantId}/api-keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-default-500 mt-1">Manage API keys for programmatic access</p>
        </div>
        <Button variant="primary" size="sm" onPress={() => { setShowCreate(!showCreate); setCreatedKey(null); }}>
          <Plus size={14} className="mr-1" /> Create Key
        </Button>
      </div>

      {showCreate && (
        <Card>
          <Card.Header><Card.Title>Create New API Key</Card.Title></Card.Header>
          <Card.Content className="space-y-4">
            {createdKey ? (
              <div className="space-y-3">
                <p className="text-sm text-warning font-medium">Copy this key now — you won’t see it again!</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-default-100 text-sm font-mono break-all">{createdKey}</code>
                  <Button variant="ghost" size="sm" onPress={() => navigator.clipboard.writeText(createdKey)}>
                    <Copy size={14} />
                  </Button>
                </div>
                <Button variant="secondary" size="sm" onPress={() => { setShowCreate(false); setCreatedKey(null); }}>Done</Button>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Key Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI Pipeline"
                    className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="w-40">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <Button variant="primary" size="sm" onPress={() => createMutation.mutate()} isDisabled={!name || createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !keys || keys.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <EmptyState>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
                  <Key size={24} className="text-default-400" />
                </div>
                <h3 className="text-base font-medium text-foreground">No API keys</h3>
                <p className="mt-1 text-sm text-default-500">Create an API key for programmatic access to the orchestrator.</p>
              </div>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Key Prefix</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Last Used</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Created</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-default-50">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{k.name}</td>
                    <td className="px-5 py-3"><code className="text-xs font-mono text-default-500">{k.keyPrefix}...</code></td>
                    <td className="px-5 py-3"><Chip variant="soft" size="sm">{k.role}</Chip></td>
                    <td className="px-5 py-3 text-xs text-default-400">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td className="px-5 py-3 text-xs text-default-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" onPress={() => revokeMutation.mutate(k.id)} isDisabled={revokeMutation.isPending}>
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    </td>
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
