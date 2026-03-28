import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner } from '@heroui/react';
import { apiFetch, getTenantId } from '../lib/api';
import { Webhook, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface WebhookConfig {
  id: string;
  platform: string;
  url: string;
  secret?: string;
  isActive: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  platform: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  retryCount: number;
  createdAt: string;
}

export function WebhooksPage() {
  const tenantId = getTenantId();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['webhook-configs', tenantId],
    queryFn: () => apiFetch<WebhookConfig[]>(`/tenants/${tenantId}/webhooks`).catch(() => []),
  });

  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries', tenantId],
    queryFn: () => apiFetch<{ data: WebhookDelivery[] }>(`/webhook-deliveries?limit=20`).catch(() => ({ data: [] })),
    refetchInterval: 10000,
  });

  const DELIVERY_STATUS: Record<string, { color: 'success' | 'danger' | 'warning' | 'default'; icon: React.ElementType }> = {
    delivered: { color: 'success', icon: CheckCircle2 },
    failed: { color: 'danger', icon: XCircle },
    pending: { color: 'warning', icon: Clock },
    retrying: { color: 'warning', icon: RefreshCw },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-sm text-default-500 mt-1">Configure and monitor webhook integrations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><Card.Content className="pt-5">
          <p className="text-xs text-default-500 uppercase tracking-wider">Configurations</p>
          <p className="text-2xl font-bold text-foreground mt-1">{configs?.length ?? 0}</p>
          <p className="text-xs text-default-400 mt-0.5">active webhooks</p>
        </Card.Content></Card>
        <Card><Card.Content className="pt-5">
          <p className="text-xs text-default-500 uppercase tracking-wider">Recent Deliveries</p>
          <p className="text-2xl font-bold text-foreground mt-1">{deliveries?.data?.length ?? 0}</p>
          <p className="text-xs text-default-400 mt-0.5">last 20 events</p>
        </Card.Content></Card>
        <Card><Card.Content className="pt-5">
          <p className="text-xs text-default-500 uppercase tracking-wider">Failed</p>
          <p className="text-2xl font-bold text-danger mt-1">{deliveries?.data?.filter(d => d.status === 'failed').length ?? 0}</p>
          <p className="text-xs text-default-400 mt-0.5">requiring attention</p>
        </Card.Content></Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Webhook Configurations</Card.Title>
        </Card.Header>
        {isLoading ? (
          <Card.Content><div className="flex justify-center py-8"><Spinner /></div></Card.Content>
        ) : !configs || configs.length === 0 ? (
          <Card.Content className="py-12">
            <div className="text-center">
              <Webhook size={32} className="mx-auto text-default-300 mb-2" />
              <p className="text-sm text-default-400">No webhook configurations. Configure webhooks via the API.</p>
            </div>
          </Card.Content>
        ) : (
          <div className="divide-y divide-divider">
            {configs.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Chip variant="soft" size="sm">{c.platform}</Chip>
                    <span className="text-sm text-foreground">{c.url}</span>
                  </div>
                </div>
                <Chip color={c.isActive ? 'success' : 'default'} variant="soft" size="sm">{c.isActive ? 'Active' : 'Inactive'}</Chip>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Card.Header><Card.Title>Recent Deliveries</Card.Title></Card.Header>
        {deliveries?.data && deliveries.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Platform</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Event</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">HTTP</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Retries</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {deliveries.data.map((d) => {
                  const info = DELIVERY_STATUS[d.status] ?? { color: 'default' as const, icon: Clock };
                  return (
                    <tr key={d.id} className="hover:bg-default-50">
                      <td className="px-5 py-3"><Chip variant="soft" size="sm">{d.platform}</Chip></td>
                      <td className="px-5 py-3 text-sm text-foreground">{d.eventType}</td>
                      <td className="px-5 py-3"><Chip color={info.color} variant="soft" size="sm">{d.status}</Chip></td>
                      <td className="px-5 py-3 text-right text-sm text-default-500">{d.statusCode ?? '—'}</td>
                      <td className="px-5 py-3 text-right text-sm text-default-500">{d.retryCount}</td>
                      <td className="px-5 py-3 text-right text-xs text-default-400">{new Date(d.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card.Content><p className="text-sm text-default-400 text-center py-4">No deliveries yet</p></Card.Content>
        )}
      </Card>
    </div>
  );
}
