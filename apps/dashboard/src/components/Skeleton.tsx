import { cn } from '../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-default-200', className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-divider bg-background p-5 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-divider bg-background overflow-hidden">
      <div className="border-b border-divider px-5 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-5 py-3.5 flex gap-4 border-b border-divider last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', count === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : `grid-cols-1 md:grid-cols-${Math.min(count, 3)}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-divider bg-background p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ title, hasStats = true, hasTable = true }: { title: string; hasStats?: boolean; hasTable?: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <Skeleton className="h-4 w-32 mt-2" />
      </div>
      {hasStats && <SkeletonStats />}
      {hasTable && <SkeletonTable />}
    </div>
  );
}
