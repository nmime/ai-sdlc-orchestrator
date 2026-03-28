import { useState } from 'react';
import { WorkflowList } from './components/WorkflowList';
import { CostDashboard } from './components/CostDashboard';
import { GatePanel } from './components/GatePanel';
import { TenantConfig } from './components/TenantConfig';
import { SessionViewer } from './components/SessionViewer';
import { DslEditor } from './components/DslEditor';
import { Settings } from './components/Settings';

type Tab = 'workflows' | 'costs' | 'gates' | 'tenants' | 'sessions' | 'dsl-editor' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'costs', label: 'Costs' },
  { key: 'gates', label: 'Gates' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'dsl-editor', label: 'DSL Editor' },
  { key: 'settings', label: 'Settings' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('workflows');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">AI SDLC Orchestrator</h1>
          <nav className="flex gap-4">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  activeTab === key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'workflows' && <WorkflowList />}
        {activeTab === 'costs' && <CostDashboard />}
        {activeTab === 'gates' && <GatePanel />}
        {activeTab === 'tenants' && <TenantConfig />}
        {activeTab === 'sessions' && <SessionViewer />}
        {activeTab === 'dsl-editor' && <DslEditor />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
