import { useState } from 'react';
import { Card, Button, TextField, Label, Input, Description } from '@heroui/react';
import { setApiToken, getApiToken } from '../lib/api';

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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-default-500">Configure your dashboard connection settings</p>
      </div>

      <div className="max-w-xl">
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
      </div>
    </div>
  );
}
