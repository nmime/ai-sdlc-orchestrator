import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip } from '@heroui/react';
import { apiFetch, getTenantId, isDemoMode } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { RelativeTime } from '../components/RelativeTime';
import { Webhook, RefreshCw } from 'lucide-react';
import { SkeletonTable } from '../components/Skeleton';

interface WebhookDelivery {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  httpStatus?: number;
  retryCount: number;
  createdAt: string;
  processedAt?: string;
  repoUrl?: string;
  taskTitle?: string;
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
  delivered: 'success', processed: 'success', pending: 'warning', failed: 'danger', retrying: 'warning',
};

const PAGE_SIZE = 20;

export function WebhooksPage() {
  const tenantId = getTenantId();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', tenantId, page],
    queryFn: () => apiFetch<{ data: WebhookDelivery[]; total: number }>(
      `/webhook-deliveries?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`
    ),
    refetchInterval: 10000,
  });

  const deliveries = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Webhook Deliveries</h1>
        <p className="text-sm text-default-500 mt-1">
          {data?.total ?? 0} total deliveries
          {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
        </p>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : deliveries.length === 0 ? (
        <Card>
          <Card.Content className="py-16 text-center">
            <Webhook size={32} className="mx-auto text-default-300 mb-3" />
            <p className="text-base font-medium text-foreground">No webhook deliveries</p>
            <p className="text-sm text-default-500 mt-1">Deliveries appear when external services send webhooks.</p>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Provider</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Event</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase">Task</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-default-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-foreground capitalize">{d.provider}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-mono text-default-500">{d.eventType}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Chip color={STATUS_COLOR[d.status] ?? 'default'} variant="soft" size="sm">{d.status}</Chip>
                        {d.retryCount > 0 && (
                          <span className="text-xs text-default-400 flex items-center gap-1">
                            <RefreshCw size={10} /> {d.retryCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-default-500 truncate block max-w-[200px]">{d.taskTitle || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <RelativeTime date={d.createdAt} className="text-xs text-default-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}
