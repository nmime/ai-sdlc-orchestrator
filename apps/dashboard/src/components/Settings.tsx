import { useState, useEffect, useCallback } from 'react';
import { Card, Button, TextField, Label, Input, Description } from '@heroui/react';
import { setApiToken, getApiToken, apiFetch } from '../lib/api';

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  valueType: string;
  updatedAt: string;
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
    } catch (e) {
      setError((e as Error).message);
    }
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
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(null);
  };

  if (error) return <p className="text-danger text-sm">{error}</p>;

  return (
    <Card>
      <Card.Header>
        <Card.Title>System Settings</Card.Title>
        <Card.Description>Global configuration stored in DB — changes take effect within 30 seconds</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        {settings.map(s => (
          <div key={s.key} className="flex items-end gap-2">
            <TextField
              className="flex-1"
              value={editValues[s.key] ?? s.value}
              onChange={(v) => setEditValues(prev => ({ ...prev, [s.key]: v }))}
            >
              <Label>{s.key}</Label>
              <Input />
              {s.description && <Description>{s.description}</Description>}
            </TextField>
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

export function Settings() {
  const [token, setToken] = useState(getApiToken());
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenant_id') || '00000000-0000-0000-0000-000000000001');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiToken(token);
    localStorage.setItem('tenant_id', tenantId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-default-500">Configure dashboard and system settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <Card.Header>
            <Card.Title>Connection Settings</Card.Title>
            <Card.Description>Configure API authentication and tenant scope</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-5">
            <TextField type="password" value={token} onChange={setToken}>
              <Label>API Token (Bearer)</Label>
              <Input placeholder="Leave empty for dev bypass" />
              <Description>Used as Authorization: Bearer &lt;token&gt; for API calls</Description>
            </TextField>
            <TextField value={tenantId} onChange={setTenantId}>
              <Label>Tenant ID</Label>
              <Input placeholder="00000000-0000-0000-0000-000000000001" />
              <Description>Used for cost queries, DSL operations, and scoped data</Description>
            </TextField>
          </Card.Content>
          <Card.Footer>
            <Button variant={saved ? 'secondary' : 'primary'} onPress={handleSave}>
              {saved ? 'Saved!' : 'Save Settings'}
            </Button>
          </Card.Footer>
        </Card>

        <SystemSettingsPanel />
      </div>
    </div>
  );
}
