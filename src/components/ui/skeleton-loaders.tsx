import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI card grid skeleton */
export function KPICardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-card border-0">
          <CardContent className="p-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Widget card skeleton (queue, appointments, etc.) */
export function WidgetCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Patient/contact list skeleton */
export function PatientListSkeleton({ count = 6 }: { count?: number }) {
  return <ListSkeleton count={count} avatar lines={2} trailing />;
}

/** Generic, reusable list skeleton — works for patients, leads, tasks, etc. */
export function ListSkeleton({
  count = 6,
  avatar = true,
  lines = 2,
  trailing = false,
  className,
}: {
  count?: number;
  avatar?: boolean;
  lines?: 1 | 2 | 3;
  trailing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-card border-0">
          <CardContent className="p-3 flex items-center gap-3">
            {avatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              {lines >= 2 && <Skeleton className="h-2.5 w-1/4" />}
              {lines >= 3 && <Skeleton className="h-2.5 w-1/2" />}
            </div>
            {trailing && <Skeleton className="h-5 w-16 rounded-full" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Premium table skeleton — matches the standardized rounded table wrapper. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full rounded-xl border border-border/60 overflow-hidden bg-card", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex gap-4 px-4 py-3 bg-muted/40 border-b border-border/60">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-border/60 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Form skeleton — for slow-loading edit pages and dialogs. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-live="polite">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Detail / profile page skeleton */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <Card className="shadow-card border-0">
        <CardContent className="p-5 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-card border-0">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
