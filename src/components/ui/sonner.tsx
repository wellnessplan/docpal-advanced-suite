import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Premium global toast — semantic tokens for success / error / warning / info.
 * Use: toast.success("Saved"), toast.error("Failed"), toast.warning("Heads up"), toast("Info").
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand
      richColors={false}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 pr-10 shadow-elevated " +
            "group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border/60 backdrop-blur",
          title: "text-sm font-semibold tracking-tight",
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-card group-[.toast]:border-border/60 group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
          success:
            "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-emerald-50 dark:group-[.toaster]:bg-emerald-950/40 group-[.toaster]:text-emerald-900 dark:group-[.toaster]:text-emerald-100",
          error:
            "group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive",
          warning:
            "group-[.toaster]:border-amber-500/30 group-[.toaster]:bg-amber-50 dark:group-[.toaster]:bg-amber-950/40 group-[.toaster]:text-amber-900 dark:group-[.toaster]:text-amber-100",
          info:
            "group-[.toaster]:border-sky-500/30 group-[.toaster]:bg-sky-50 dark:group-[.toaster]:bg-sky-950/40 group-[.toaster]:text-sky-900 dark:group-[.toaster]:text-sky-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
