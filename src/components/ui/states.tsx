import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Inbox, Loader2, LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Premium, theme-aware empty state. Use across all list/table pages. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed border-border/70 bg-card/60", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center py-14 md:py-20 px-6">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-card">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="font-heading text-lg md:text-xl font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this section. Please try again in a moment.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center py-12 md:py-16 px-6">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="font-heading text-lg md:text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-6 gap-2" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface LoaderStateProps {
  label?: string;
  className?: string;
  rows?: number;
}

export function LoaderState({ label = "Loading…", className, rows = 4 }: LoaderStateProps) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{label}</span>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/** Full-page centered spinner — for route-level suspense fallbacks. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
