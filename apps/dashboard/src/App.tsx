import { useState } from 'react';
import { WorkflowList } from './components/WorkflowList';
import { CostDashboard } from './components/CostDashboard';
import { GatePanel } from './components/GatePanel';

export function App() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'costs' | 'gates'>('workflows');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">AI SDLC Orchestrator</h1>
          <nav className="flex gap-4">
            {(['workflows', 'costs', 'gates'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  activeTab === tab
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'workflows' && <WorkflowList />}
        {activeTab === 'costs' && <CostDashboard />}
        {activeTab === 'gates' && <GatePanel />}
      </main>
    </div>
  );
}
