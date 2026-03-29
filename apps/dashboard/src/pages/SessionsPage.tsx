import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip } from '@heroui/react';
import { apiFetch, isDemoMode } from '../lib/api';
import { Monitor, Cpu, Coins, Clock, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonCard, Skeleton } from '../components/Skeleton';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  startedAt: string;
}

interface AgentSession {
  id: string;
  agentSummary: string;
  stepId: string;
  loopIteration: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  totalCostUsd: number;
  toolCallCount: number;
  sandboxDurationSeconds: number;
  turnCount: number;
  qualityScore: number | null;
  status: string;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
}

type SortField = 'startedAt' | 'totalCostUsd' | 'tokens' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_COLOR: Record<string, 'default' | 'accent' | 'success' | 'danger'> = {
  running: 'accent', completed: 'success', failed: 'danger', cancelled: 'default',
};

const PAGE_SIZE = 10;

export function SessionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['session-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?limit=20'),
    refetchInterval: 10000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions', selectedId],
    queryFn: () => apiFetch<AgentSession[]>(`/workflows/${selectedId}/sessions`),
    enabled: !!selectedId,
  });

  const filtered = useMemo(() => {
    const list = sessions ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s) =>
        s.agentSummary?.toLowerCase().includes(q) ||
        s.stepId.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'startedAt':
          cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
          break;
        case 'totalCostUsd':
          cmp = a.totalCostUsd - b.totalCostUsd;
          break;
        case 'tokens':
          cmp = (a.inputTokens + a.outputTokens) - (b.inputTokens + b.outputTokens);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  if (isLoading) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Sessions</h1>
        <p className="text-sm text-default-500 mt-1">
          Inspect agent sessions per workflow
          {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
        </p>
      </div>
      <div className="flex gap-6 h-[calc(100vh-14rem)]">
        <SkeletonCard className="w-1/3 h-full" />
        <SkeletonCard className="w-2/3 h-full" />
      </div>
    </div>
  );

  const wfList = workflows?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Sessions</h1>
        <p className="text-sm text-default-500 mt-1">
          Inspect agent sessions per workflow
          {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-14rem)]">
        <Card className="w-1/3 overflow-hidden flex flex-col">
          <Card.Header><Card.Title className="text-sm">Workflows</Card.Title></Card.Header>
          <div className="overflow-y-auto flex-1">
            {wfList.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-default-400">No workflows yet</div>
            ) : (
              <div className="divide-y divide-divider">
                {wfList.map((wf) => (
                  <button
                    key={wf.id}
                    onClick={() => { setSelectedId(wf.id); setPage(0); setSearch(''); }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-default-100 ${
                      selectedId === wf.id ? 'bg-primary/5 border-l-3 border-primary' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground truncate">{wf.taskTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Chip color={STATUS_COLOR[wf.status] ?? 'default'} variant="soft" size="sm">{wf.status}</Chip>
                      <span className="text-xs text-default-400">{new Date(wf.startedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="w-2/3 overflow-hidden flex flex-col">
          {selectedId ? (
            <>
              <Card.Header>
                <div className="flex items-center justify-between w-full">
                  <Card.Title className="text-sm">Sessions ({filtered.length})</Card.Title>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                      placeholder="Search sessions..."
                      className="pl-9 pr-3 py-1.5 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-56 placeholder:text-default-400"
                    />
                  </div>
                </div>
              </Card.Header>

              <div className="border-b border-divider px-5 py-2 flex items-center gap-1 text-xs">
                <SortButton label="Date" field="startedAt" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortButton label="Cost" field="totalCostUsd" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortButton label="Tokens" field="tokens" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortButton label="Status" field="status" current={sortField} dir={sortDir} onClick={toggleSort} />
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-divider">
                {paginated.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-default-400 text-sm">
                    {search ? 'No matching sessions' : 'No sessions for this workflow'}
                  </div>
                ) : (
                  paginated.map((s) => (
                    <div key={s.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.stepId} <span className="text-default-400">loop {s.loopIteration}</span></p>
                          {s.agentSummary && <p className="text-xs text-default-500 mt-0.5">{s.agentSummary}</p>}
                        </div>
                        <Chip color={STATUS_COLOR[s.status] ?? 'default'} variant="soft" size="sm">{s.status}</Chip>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <MiniStat icon={Cpu} label="Tokens" value={(s.inputTokens + s.outputTokens).toLocaleString()} />
                        <MiniStat icon={Coins} label="AI Cost" value={`$${(s.aiCostUsd ?? 0).toFixed(4)}`} />
                        <MiniStat icon={Monitor} label="Sandbox" value={`$${(s.sandboxCostUsd ?? 0).toFixed(4)}`} />
                        <MiniStat icon={Clock} label="Duration" value={`${s.sandboxDurationSeconds}s`} />
                      </div>
                      {s.errorCode && <p className="text-xs text-danger">Error: {s.errorCode}</p>}
                    </div>
                  ))
                )}
              </div>

              {totalPages > 1 && (
                <div className="border-t border-divider px-5 py-2 flex items-center justify-between">
                  <span className="text-xs text-default-400">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded hover:bg-default-100 disabled:opacity-30 disabled:cursor-not-allowed text-default-500"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-default-500 px-2">{page + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1 rounded hover:bg-default-100 disabled:opacity-30 disabled:cursor-not-allowed text-default-500"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Monitor size={32} className="mx-auto text-default-300 mb-2" />
                <p className="text-sm text-default-400">Select a workflow to view sessions</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SortButton({ label, field, current, dir, onClick }: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-0.5 px-2 py-1 rounded hover:bg-default-100 transition-colors ${
        active ? 'text-primary font-medium' : 'text-default-500'
      }`}
    >
      {label}
      {active && (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-2.5 py-2 flex items-center gap-2">
      <Icon size={14} className="text-default-400 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-default-400 uppercase">{label}</p>
        <p className="text-xs font-medium text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}
