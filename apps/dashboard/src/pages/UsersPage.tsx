import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip } from '@heroui/react';
import { apiFetch, getTenantId, mutationOptions, isDemoMode } from '../lib/api';
import { Users, Plus, Mail, Shield, Clock } from 'lucide-react';
import { SkeletonTable } from '../components/Skeleton';

interface TenantUser {
  id: string;
  externalId: string;
  provider: string;
  email: string;
  role: string;
  repoAccess?: string[];
  createdAt: string;
}

const ROLE_COLOR: Record<string, 'default' | 'warning' | 'accent'> = {
  admin: 'accent',
  operator: 'warning',
  viewer: 'default',
};

export function UsersPage() {
  const tenantId = getTenantId();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [provider, setProvider] = useState('email');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => apiFetch<TenantUser[]>(`/tenants/${tenantId}/users`),
  });

  const inviteMutation = useMutation({
    mutationFn: () => apiFetch(`/tenants/${tenantId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: email, provider, email, role }),
    }),
    ...mutationOptions('User added successfully'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEmail('');
      setShowInvite(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
          <p className="text-sm text-default-500 mt-1">
            Manage users and their roles within your tenant
            {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
          </p>
        </div>
        <Button variant="primary" size="sm" onPress={() => setShowInvite(!showInvite)}>
          <Plus size={14} className="mr-1" /> Add User
        </Button>
      </div>

      {showInvite && (
        <Card>
          <Card.Header><Card.Title>Add Team Member</Card.Title></Card.Header>
          <Card.Content className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="w-36">
                <label className="block text-sm font-medium text-foreground mb-1.5">Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="email">Email</option>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </div>
              <Button variant="primary" size="sm" onPress={() => inviteMutation.mutate()} isDisabled={!email || inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {isLoading ? (
        <SkeletonTable rows={3} cols={4} />
      ) : !users || users.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
                <Users size={24} className="text-default-400" />
              </div>
              <h3 className="text-base font-medium text-foreground">No team members</h3>
              <p className="mt-1 text-sm text-default-500">Add users to collaborate on workflows and manage your tenant.</p>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">User</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-default-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mail size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.email}</p>
                          <p className="text-xs text-default-400 font-mono">{u.externalId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Chip variant="soft" size="sm">{u.provider}</Chip>
                    </td>
                    <td className="px-5 py-3">
                      <Chip color={ROLE_COLOR[u.role] ?? 'default'} variant="soft" size="sm">
                        <Shield size={10} className="mr-1" />{u.role}
                      </Chip>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-default-400 flex items-center gap-1">
                        <Clock size={12} />{new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <Card.Header>
          <Card.Title>Role Permissions</Card.Title>
          <Card.Description>Understanding what each role can do</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <h4 className="text-sm font-semibold text-primary">Admin</h4>
              <ul className="mt-2 space-y-1 text-xs text-default-600">
                <li>Manage tenant settings</li>
                <li>Add/remove users</li>
                <li>Create/revoke API keys</li>
                <li>Full workflow control</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
              <h4 className="text-sm font-semibold text-warning">Operator</h4>
              <ul className="mt-2 space-y-1 text-xs text-default-600">
                <li>View team members</li>
                <li>Manage workflows</li>
                <li>Approve gates</li>
                <li>View costs and sessions</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-default-100">
              <h4 className="text-sm font-semibold text-foreground">Viewer</h4>
              <ul className="mt-2 space-y-1 text-xs text-default-600">
                <li>View workflows</li>
                <li>View sessions</li>
                <li>View costs</li>
                <li>Read-only access</li>
              </ul>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
