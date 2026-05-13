import * as React from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown;
  children: React.ReactNode;
  /** Distance in px before refresh triggers on release */
  threshold?: number;
  /** Disable on non-touch / desktop */
  disabled?: boolean;
  className?: string;
}

/**
 * Touch-only pull-to-refresh. Only activates when the inner scroll container
 * is at the very top. Falls through to native scroll otherwise.
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 64,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startY = React.useRef<number | null>(null);
  const armed = React.useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    // Only arm if the page is scrolled to the top
    const scrollTop =
      document.scrollingElement?.scrollTop ?? document.documentElement.scrollTop ?? 0;
    if (scrollTop > 0) {
      armed.current = false;
      return;
    }
    armed.current = true;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!armed.current || startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Resistance curve
    const resisted = Math.min(threshold * 1.8, dy * 0.5);
    setPull(resisted);
  };

  const onTouchEnd = async () => {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= threshold && !refreshing) {
      setRefreshing(true);
      setPull(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const ready = pull >= threshold;

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        armed.current = false;
        startY.current = null;
        setPull(0);
      }}
    >
      {/* Indicator */}
      <div
        className="absolute left-0 right-0 -top-2 flex items-center justify-center pointer-events-none"
        style={{
          height: pull,
          opacity: pull > 8 ? 1 : 0,
          transition: refreshing || pull === 0 ? "all 200ms ease" : "none",
        }}
        aria-hidden
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing…
            </>
          ) : (
            <>
              <ArrowDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  ready ? "rotate-180 text-primary" : ""
                )}
              />
              {ready ? "Release to refresh" : "Pull to refresh"}
            </>
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translate3d(0, ${pull}px, 0)`,
          transition: refreshing || pull === 0 ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
