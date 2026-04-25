import { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, User, Stethoscope, Receipt, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UserMenuDropdown from "@/components/UserMenuDropdown";

interface FocusLayoutProps {
  children: ReactNode;
  /** Which step in the flow is active: 1=Today, 2=Patient view */
  activeStep: 1 | 2;
  /** Sub-step within Patient (chart/bill) for visual hint only */
  patientSubStep?: "chart" | "bill";
}

const steps = [
  { num: 1, label: "Today", sub: "Schedule · Queue · Follow-ups", icon: CalendarClock },
  { num: 2, label: "Patient", sub: "Chart · Rx · Bill", icon: User },
];

export default function FocusLayout({ children, activeStep, patientSubStep }: FocusLayoutProps) {
  const { id } = useParams();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar with flow indicator */}
      <header className="border-b bg-gradient-to-r from-[hsl(210,80%,32%)] via-[hsl(205,75%,38%)] to-[hsl(200,70%,28%)] text-white shadow-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 gap-1.5 h-8">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Exit Focus</span>
            </Button>
          </Link>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4" />
            <span className="font-heading text-sm font-bold tracking-tight">Focus Mode</span>
          </div>

          {/* Flow steps - desktop */}
          <div className="ml-4 hidden md:flex items-center gap-1.5 flex-1">
            {steps.map((s, i) => {
              const isActive = activeStep === s.num;
              const isDone = activeStep > s.num;
              const Icon = s.icon;
              return (
                <div key={s.num} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all",
                      isActive && "bg-white text-primary shadow-sm",
                      !isActive && isDone && "bg-white/20 text-white",
                      !isActive && !isDone && "text-white/70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        isActive ? "bg-primary text-white" : "bg-white/20 text-white"
                      )}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : s.num}
                    </div>
                    <Icon className="h-3.5 w-3.5" />
                    <div className="leading-tight">
                      <div className="text-xs font-bold">{s.label}</div>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={cn("h-px w-6", activeStep > s.num ? "bg-white" : "bg-white/30")} />
                  )}
                </div>
              );
            })}

            {activeStep === 2 && patientSubStep && (
              <div className="ml-2 flex items-center gap-1 text-xs">
                <span className="text-white/60">›</span>
                <span className="capitalize font-semibold">{patientSubStep}</span>
              </div>
            )}
          </div>

          {/* Mobile compact step indicator */}
          <div className="md:hidden flex-1 text-center">
            <span className="text-xs font-bold">
              Step {activeStep} of 2 · {steps[activeStep - 1].label}
            </span>
          </div>

          <UserMenuDropdown />
        </div>

        {/* Mobile sub-line */}
        <div className="md:hidden border-t border-white/10 px-4 py-1.5 text-[11px] text-white/80 text-center">
          {steps[activeStep - 1].sub}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-5">{children}</div>
      </main>
    </div>
  );
}
