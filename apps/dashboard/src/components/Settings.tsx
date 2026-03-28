import { useState } from 'react';
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
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>
      <div>
        <label className="block text-sm text-gray-600 mb-1">API Token (Bearer)</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Leave empty for dev bypass"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Used as Authorization: Bearer &lt;token&gt; for API calls</p>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Tenant ID</label>
        <input
          type="text"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000001"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Used for cost queries and DSL operations</p>
      </div>
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
