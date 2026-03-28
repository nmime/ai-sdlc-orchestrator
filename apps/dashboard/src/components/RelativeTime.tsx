import { formatDistanceToNow } from 'date-fns';

export function RelativeTime({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className={className}>
      {formatDistanceToNow(d, { addSuffix: true })}
    </time>
  );
}
