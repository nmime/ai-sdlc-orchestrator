import { useState } from 'react';
import { Tabs, Card, Chip } from '@heroui/react';
import { WorkflowList } from './components/WorkflowList';
import { CostDashboard } from './components/CostDashboard';
import { GatePanel } from './components/GatePanel';
import { TenantConfig } from './components/TenantConfig';
import { SessionViewer } from './components/SessionViewer';
import { DslEditor } from './components/DslEditor';
import { Settings } from './components/Settings';

const TABS = [
  { id: 'workflows', label: 'Workflows' },
  { id: 'costs', label: 'Costs' },
  { id: 'gates', label: 'Gates' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'dsl', label: 'DSL Editor' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workflows');

  return (
    <div className="min-h-full bg-default-50">
      <header className="bg-background border-b border-divider sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">AI SDLC Orchestrator</h1>
                <p className="text-[11px] text-default-400">Development Environment</p>
              </div>
            </div>
            <Chip color="success" variant="soft" size="sm">System Healthy</Chip>
          </div>

          <div className="-mb-px">
            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as TabId)}>
              <Tabs.List>
                {TABS.map((tab) => (
                  <Tabs.Tab key={tab.id} id={tab.id}>{tab.label}</Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        {activeTab === 'workflows' && <WorkflowList />}
        {activeTab === 'costs' && <CostDashboard />}
        {activeTab === 'gates' && <GatePanel />}
        {activeTab === 'tenants' && <TenantConfig />}
        {activeTab === 'sessions' && <SessionViewer />}
        {activeTab === 'dsl' && <DslEditor />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
