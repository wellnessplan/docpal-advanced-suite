import { cn } from "@/lib/utils";

/**
 * Premium skeleton with a subtle left-to-right shimmer using semantic tokens.
 * Falls back to a soft pulse if motion is reduced.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent",
        "motion-reduce:animate-pulse motion-reduce:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
