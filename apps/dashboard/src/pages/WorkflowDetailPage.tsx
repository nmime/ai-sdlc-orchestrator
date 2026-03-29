import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Card, Chip, Spinner, Button } from '@heroui/react';
import { apiFetch, mutationOptions } from '../lib/api';
import { RelativeTime } from '../components/RelativeTime';
import {
  ArrowLeft, GitBranch, Clock, DollarSign, Cpu, Monitor,
  ShieldCheck, XCircle, CheckCircle2, Coins, RefreshCw, RotateCcw, ExternalLink,
  FileText, FileCode, FileImage, FileBarChart, FileArchive, File, GitPullRequest, Download
} from 'lucide-react';

interface WorkflowDetail {
  id: string;
  taskTitle: string;
  taskUrl?: string;
  status: string;
  repoUrl: string;
  branchName?: string;
  totalCostUsd: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  startedAt: string;
  completedAt?: string;
  agentProvider?: string;
  agentModel?: string;
  temporalWorkflowId: string;
  pullRequestUrl?: string;
  failureReason?: string;
  gateStatus?: string;
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

interface Artifact {
  id: string;
  kind: string;
  title: string;
  uri: string;
  mimeType?: string;
  previewUrl?: string;
  metadata?: Record<string, unknown>;
  content?: string;
  status: string;
  createdAt: string;
}

function ArtifactKindIcon({ kind }: { kind: string }) {
  const k = kind.toLowerCase();
  if (k.includes('merge_request') || k.includes('pull_request')) return <GitPullRequest className="w-5 h-5" />;
  if (k.includes('document') || k.includes('report')) return <FileText className="w-5 h-5" />;
  if (k.includes('code') || k.includes('source')) return <FileCode className="w-5 h-5" />;
  if (k.includes('image') || k.includes('diagram') || k.includes('screenshot')) return <FileImage className="w-5 h-5" />;
  if (k.includes('chart') || k.includes('metric')) return <FileBarChart className="w-5 h-5" />;
  if (k.includes('archive') || k.includes('bundle')) return <FileArchive className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
}

const STATUS_MAP: Record<string, { color: 'default' | 'accent' | 'success' | 'warning' | 'danger'; label: string }> = {
  queued: { color: 'default', label: 'Queued' },
  running: { color: 'accent', label: 'Running' },
  awaiting_gate: { color: 'warning', label: 'Awaiting Gate' },
  awaiting_ci: { color: 'warning', label: 'Awaiting CI' },
  completed: { color: 'success', label: 'Completed' },
  failed: { color: 'danger', label: 'Failed' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

export function WorkflowDetailPage() {
  const { workflowId } = useParams({ strict: false }) as { workflowId: string };
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'sessions' | 'artifacts'>('overview');

  const { data: wf, isLoading } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => apiFetch<WorkflowDetail>(`/workflows/${workflowId}`),
    refetchInterval: 5000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['workflow-sessions', workflowId],
    queryFn: () => apiFetch<AgentSession[]>(`/workflows/${workflowId}/sessions`),
    enabled: tab === 'sessions',
  });

  const { data: artifacts } = useQuery({
    queryKey: ['workflow-artifacts', workflowId],
    queryFn: () => apiFetch<Artifact[]>(`/workflows/${workflowId}/artifacts`).catch(() => []),
    enabled: tab === 'artifacts',
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/workflows/${workflowId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelled from dashboard' }),
    }),
    ...mutationOptions('Workflow cancelled'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => apiFetch(`/workflows/${workflowId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
    ...mutationOptions('Workflow retry initiated'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!wf) return <div className="text-center py-16 text-default-500">Workflow not found</div>;

  const status = STATUS_MAP[wf.status] ?? { color: 'default' as const, label: wf.status };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/app/workflows" className="p-2 rounded-lg hover:bg-default-100 transition-colors">
          <ArrowLeft size={20} className="text-default-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground truncate">{wf.taskTitle}</h1>
            <Chip color={status.color} variant="soft" size="sm">{status.label}</Chip>
          </div>
          <p className="text-sm text-default-400 mt-1 font-mono truncate">{wf.temporalWorkflowId}</p>
        </div>
        {(wf.status === 'running' || wf.status === 'awaiting_gate') && (
          <Button variant="outline" size="sm" onPress={() => cancelMutation.mutate()} isDisabled={cancelMutation.isPending}>
            <XCircle size={14} className="mr-1" /> Cancel
          </Button>
        )}
        {(wf.status === 'failed' || wf.status === 'cancelled') && (
          <Button variant="primary" size="sm" onPress={() => retryMutation.mutate()} isDisabled={retryMutation.isPending}>
            <RotateCcw size={14} className="mr-1" /> Retry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Cost" value={`$${wf.totalCostUsd.toFixed(2)}`} />
        <StatCard icon={Cpu} label="AI Cost" value={`$${(wf.aiCostUsd ?? 0).toFixed(2)}`} />
        <StatCard icon={Monitor} label="Sandbox Cost" value={`$${(wf.sandboxCostUsd ?? 0).toFixed(2)}`} />
        <StatCard icon={Clock} label="Started" value={<RelativeTime date={wf.startedAt} className="text-sm font-medium" />} />
      </div>

      <Card>
        <Card.Content className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-default-400 block text-xs">Repository</span>
              <a href={wf.repoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">
                {wf.repoUrl.replace('https://github.com/', '')}
              </a>
            </div>
            {wf.branchName && (
              <div>
                <span className="text-default-400 block text-xs">Branch</span>
                <span className="font-mono text-foreground">{wf.branchName}</span>
              </div>
            )}
            {wf.agentProvider && (
              <div>
                <span className="text-default-400 block text-xs">Provider</span>
                <span className="text-foreground">{wf.agentProvider} {wf.agentModel && `/ ${wf.agentModel}`}</span>
              </div>
            )}
            {wf.pullRequestUrl && (
              <div>
                <span className="text-default-400 block text-xs">Pull Request</span>
                <a href={wf.pullRequestUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  View PR <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
          {wf.failureReason && (
            <div className="mt-4 p-3 rounded-lg bg-danger/10 text-danger text-sm">
              <strong>Failure:</strong> {wf.failureReason}
            </div>
          )}
        </Card.Content>
      </Card>

      <div className="flex gap-1 border-b border-divider">
        {(['overview', 'sessions', 'artifacts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-default-500 hover:text-foreground'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card>
          <Card.Header><Card.Title>Timeline</Card.Title></Card.Header>
          <Card.Content>
            <div className="space-y-4">
              <TimelineItem icon={<GitBranch size={16} />} label="Workflow started" time={wf.startedAt} />
              {wf.status === 'awaiting_gate' && (
                <TimelineItem icon={<ShieldCheck size={16} />} label="Awaiting gate approval" active />
              )}
              {wf.completedAt && (
                <TimelineItem
                  icon={wf.status === 'completed' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  label={wf.status === 'completed' ? 'Workflow completed' : `Workflow ${wf.status}`}
                  time={wf.completedAt}
                />
              )}
            </div>
          </Card.Content>
        </Card>
      )}

      {tab === 'sessions' && (
        <div className="space-y-4">
          {!sessions?.length ? (
            <Card><Card.Content className="py-12 text-center text-default-400 text-sm">No agent sessions recorded</Card.Content></Card>
          ) : sessions.map((s) => (
            <Card key={s.id}>
              <Card.Content className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {s.stepId} <span className="text-default-400">loop {s.loopIteration}</span>
                    </p>
                    {s.agentSummary && <p className="text-xs text-default-500 mt-0.5">{s.agentSummary}</p>}
                  </div>
                  <Chip color={s.status === 'completed' ? 'success' : s.status === 'running' ? 'accent' : s.status === 'failed' ? 'danger' : 'default'} variant="soft" size="sm">{s.status}</Chip>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MiniStat icon={Cpu} label="Tokens" value={(s.inputTokens + s.outputTokens).toLocaleString()} />
                  <MiniStat icon={Coins} label="AI Cost" value={`$${(s.aiCostUsd ?? 0).toFixed(4)}`} />
                  <MiniStat icon={Monitor} label="Sandbox" value={`$${(s.sandboxCostUsd ?? 0).toFixed(4)}`} />
                  <MiniStat icon={RefreshCw} label="Tool Calls" value={String(s.toolCallCount)} />
                  <MiniStat icon={Clock} label="Duration" value={`${s.sandboxDurationSeconds}s`} />
                </div>
                {s.errorCode && <p className="text-xs text-danger">Error: {s.errorCode}</p>}
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {tab === 'artifacts' && (
        <div className="space-y-4">
          {!artifacts?.length ? (
            <Card><Card.Content className="py-12 text-center text-default-400 text-sm">No artifacts for this workflow</Card.Content></Card>
          ) : (
            <Card>
              <div className="divide-y divide-divider">
                {artifacts.map((a) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0">
                        <ArtifactKindIcon kind={a.kind} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                        <p className="text-xs text-default-400">
                          {a.kind.replace(/_/g, ' ')}
                          {a.mimeType && <> &middot; {a.mimeType}</>}
                          {a.status && <> &middot; <span className={a.status === 'published' ? 'text-success' : 'text-default-400'}>{a.status}</span></>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RelativeTime date={a.createdAt} className="text-xs text-default-400" />
                      {a.uri?.startsWith('s3://') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            apiFetch<{ downloadUrl: string }>(`/artifacts/${a.id}/download`)
                              .then(({ downloadUrl }) => window.open(downloadUrl, '_blank'));
                          }}
                        >
                          <Download size={14} />
                        </Button>
                      )}
                      {a.uri && !a.uri.startsWith('s3://') && (
                        <a href={a.uri} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline"><ExternalLink size={14} /></Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <Card.Content className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-default-400 uppercase tracking-wider">{label}</p>
            <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className="text-default-400" />
        <span className="text-[10px] text-default-400 uppercase">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function TimelineItem({ icon, label, time, active }: { icon: React.ReactNode; label: string; time?: string; active?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-warning/10 text-warning' : 'bg-default-100 text-default-500'}`}>
        {icon}
      </div>
      <div className="pt-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {time && <RelativeTime date={time} className="text-xs text-default-400" />}
      </div>
    </div>
  );
}
