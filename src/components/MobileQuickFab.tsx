import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, UserPlus, ListOrdered, Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabAction {
  label: string;
  icon: React.ElementType;
  href: string;
  bg: string;
}

const actions: FabAction[] = [
  { label: "Add Patient", icon: UserPlus, href: "/patients?new=1", bg: "bg-primary" },
  { label: "Open Queue", icon: ListOrdered, href: "/queue", bg: "bg-warning" },
  { label: "Today", icon: Stethoscope, href: "/today-schedule", bg: "bg-success" },
];

/**
 * Mobile-only floating action button with quick doctor actions.
 * Hidden on desktop and on registration / patient-self-register pages.
 */
export default function MobileQuickFab() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;
  if (typeof window !== "undefined") {
    const p = window.location.pathname;
    if (p.startsWith("/auth") || p.startsWith("/register") || p.startsWith("/onboarding")) return null;
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px] z-40 animate-fade-in"
        />
      )}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2.5">
        {open && actions.map((a, i) => (
          <button
            key={a.label}
            onClick={() => { setOpen(false); navigate(a.href); }}
            style={{ animationDelay: `${i * 40}ms` }}
            className="flex items-center gap-2 animate-fade-in"
          >
            <span className="rounded-full bg-card border px-3 py-1.5 text-xs font-semibold shadow-elevated text-foreground">
              {a.label}
            </span>
            <span className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center text-primary-foreground shadow-elevated",
              a.bg,
            )}>
              <a.icon className="h-5 w-5" />
            </span>
          </button>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center text-primary-foreground shadow-elevated transition-transform duration-200",
            "bg-gradient-to-br from-primary to-[hsl(var(--primary)/0.85)]",
            open ? "rotate-45" : "rotate-0"
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
