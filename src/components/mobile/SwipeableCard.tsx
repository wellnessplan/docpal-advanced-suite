import * as React from "react";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Tailwind bg color class for the action panel, e.g. "bg-destructive" */
  bg?: string;
  /** Tailwind text color class, e.g. "text-destructive-foreground" */
  fg?: string;
};

interface SwipeableCardProps {
  children: React.ReactNode;
  leftAction?: Action; // revealed by swiping right
  rightAction?: Action; // revealed by swiping left
  onClick?: () => void;
  className?: string;
  /** Distance in px before action triggers on release */
  threshold?: number;
}

/**
 * Touch-only swipeable card. On desktop, behaves as a normal clickable card.
 * Swipe right → reveals leftAction (e.g. View). Swipe left → reveals rightAction (e.g. Cancel).
 */
export function SwipeableCard({
  children,
  leftAction,
  rightAction,
  onClick,
  className,
  threshold = 72,
}: SwipeableCardProps) {
  const [dx, setDx] = React.useState(0);
  const startX = React.useRef<number | null>(null);
  const startY = React.useRef<number | null>(null);
  const moved = React.useRef(false);
  const axisLocked = React.useRef<"x" | "y" | null>(null);

  const reset = () => {
    setDx(0);
    startX.current = null;
    startY.current = null;
    axisLocked.current = null;
    moved.current = false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    axisLocked.current = null;
    moved.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startX.current;
    const deltaY = t.clientY - startY.current;
    if (axisLocked.current == null) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      axisLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    }
    if (axisLocked.current !== "x") return;
    moved.current = true;
    let next = deltaX;
    if (!leftAction && next > 0) next = 0;
    if (!rightAction && next < 0) next = 0;
    // resistance beyond 1.5x threshold
    const max = threshold * 1.5;
    if (next > max) next = max + (next - max) * 0.2;
    if (next < -max) next = -max + (next + max) * 0.2;
    setDx(next);
  };

  const onTouchEnd = () => {
    if (axisLocked.current === "x") {
      if (dx > threshold && leftAction) {
        leftAction.onClick();
      } else if (dx < -threshold && rightAction) {
        rightAction.onClick();
      }
      reset();
      return;
    }
    if (!moved.current && onClick) onClick();
    reset();
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Left action (revealed on swipe right) */}
      {leftAction && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start pl-4 pr-6 text-sm font-medium",
            leftAction.bg ?? "bg-primary",
            leftAction.fg ?? "text-primary-foreground",
          )}
          style={{ width: Math.max(dx, 0) }}
          aria-hidden
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            {leftAction.icon}
            {dx > threshold * 0.6 ? leftAction.label : null}
          </span>
        </div>
      )}
      {/* Right action (revealed on swipe left) */}
      {rightAction && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-4 pl-6 text-sm font-medium",
            rightAction.bg ?? "bg-destructive",
            rightAction.fg ?? "text-destructive-foreground",
          )}
          style={{ width: Math.max(-dx, 0) }}
          aria-hidden
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            {rightAction.icon}
            {dx < -threshold * 0.6 ? rightAction.label : null}
          </span>
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={reset}
        onClick={onClick}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: dx === 0 ? "transform 200ms ease" : "none",
        }}
        className="relative bg-card touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}
