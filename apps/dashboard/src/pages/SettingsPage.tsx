import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Chip } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { getAuth, setAuth } from '../lib/auth';
import { Settings, Database, User } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  valueType: string;
  updatedAt: string;
}

interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: string;
  maxConcurrentWorkflows: number;
  maxConcurrentSandboxes: number;
  monthlyCostLimitUsd: number;
  defaultAgentProvider?: string;
  defaultAgentModel?: string;
  mcpServerPolicy: string;
}

export function SettingsPage() {
  const auth = getAuth();
  const [token, setToken] = useState(auth?.token || '');
  const [tenantId, setTenantIdLocal] = useState(auth?.tenantId || '00000000-0000-0000-0000-000000000001');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const current = auth ?? { role: 'admin', email: '', token: '', tenantId: '' };
    setAuth({ ...current, token, tenantId, role: current.role, email: current.email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-default-500 mt-1">Configure dashboard and system settings</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <User size={18} className="text-primary" />
              <Card.Title>Connection Settings</Card.Title>
            </div>
            <Card.Description>API authentication and tenant scope</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">API Token</label>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="Leave empty for dev bypass"
                className="w-full px-4 py-2.5 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Tenant ID</label>
              <input type="text" value={tenantId} onChange={(e) => setTenantIdLocal(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </Card.Content>
          <Card.Footer>
            <Button variant={saved ? 'secondary' : 'primary'} onPress={handleSave}>
              {saved ? 'Saved!' : 'Save Settings'}
            </Button>
          </Card.Footer>
        </Card>

        <SystemSettingsPanel />
        <TenantSettingsPanel />
      </div>
    </div>
  );
}

function SystemSettingsPanel() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SystemSetting[]>('/settings');
      setSettings(data);
      const vals: Record<string, string> = {};
      data.forEach(s => { vals[s.key] = s.value; });
      setEditValues(vals);
    } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      await load();
    } catch (e) { setError((e as Error).message); }
    setSaving(null);
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Database size={18} className="text-primary" />
          <Card.Title>System Settings</Card.Title>
        </div>
        <Card.Description>Global configuration stored in DB — changes take effect within 30s</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3">
        {error && <p className="text-danger text-sm">{error}</p>}
        {settings.map(s => (
          <div key={s.key} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-default-600 mb-1">{s.key}</label>
              <input
                type="text"
                value={editValues[s.key] ?? s.value}
                onChange={(e) => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {s.description && <p className="text-xs text-default-400 mt-0.5">{s.description}</p>}
            </div>
            <Button
              size="sm"
              variant={editValues[s.key] !== s.value ? 'primary' : 'outline'}
              isDisabled={editValues[s.key] === s.value || saving === s.key}
              onPress={() => handleSave(s.key)}
            >
              {saving === s.key ? '...' : 'Save'}
            </Button>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

function TenantSettingsPanel() {
  const tenantId = getTenantId();

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<TenantData[]>('/tenants'),
  });

  const tenant = tenants?.find(t => t.id === tenantId) ?? tenants?.[0];

  if (!tenant) return null;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <Card.Title>Tenant: {tenant.name}</Card.Title>
        </div>
        <Card.Description className="flex items-center gap-2">
          <span className="font-mono text-xs">{tenant.slug}</span>
          <Chip color={tenant.status === 'active' ? 'success' : 'default'} variant="soft" size="sm">{tenant.status}</Chip>
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoField label="Monthly Limit" value={`$${Number(tenant.monthlyCostLimitUsd).toFixed(0)}`} />
          <InfoField label="Max Workflows" value={String(tenant.maxConcurrentWorkflows)} />
          <InfoField label="Max Sandboxes" value={String(tenant.maxConcurrentSandboxes)} />
          <InfoField label="Agent Provider" value={tenant.defaultAgentProvider || 'auto'} />
          <InfoField label="Agent Model" value={tenant.defaultAgentModel || 'default'} />
          <InfoField label="MCP Policy" value={tenant.mcpServerPolicy} />
        </div>
      </Card.Content>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-default-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
