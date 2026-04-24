import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TourStep {
  title: string;
  body: string;
  cta: string;
  route?: string;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to your dashboard 👋",
    body: "This is your daily command center. KPIs at the top, today's appointments below, and quick actions everywhere.",
    cta: "Next",
  },
  {
    title: "Patients & dental charting",
    body: "Add patients, then click into any record to access the visual dental chart, treatment plans, and X-ray vault.",
    cta: "Show me patients",
    route: "/patients",
  },
  {
    title: "Appointments & queue",
    body: "Book appointments via day/week/month view. The Queue page handles walk-ins with token numbers.",
    cta: "Open appointments",
    route: "/appointments",
  },
  {
    title: "Billing & finance",
    body: "Generate branded invoices, track payments, manage insurance claims, and run financial reports — all linked to patients.",
    cta: "Open billing",
    route: "/billing",
  },
  {
    title: "Settings power 🔧",
    body: "Customize letterheads, working hours, automations, team access, and integrations — all in one place.",
    cta: "Finish tour",
    route: "/settings",
  },
];

export default function ProductTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("startTour") === "1") {
      setActive(true);
      setStep(0);
      sessionStorage.removeItem("startTour");
    }
  }, []);

  if (!active) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (current.route) navigate(current.route);
    if (isLast) {
      setActive(false);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/40 pointer-events-auto" onClick={() => setActive(false)} />

      {/* Tour card */}
      <Card className="absolute bottom-6 right-6 left-6 sm:left-auto sm:w-[380px] p-5 shadow-elevated border-0 pointer-events-auto animate-fade-in">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setActive(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <h3 className="font-heading text-base font-semibold mb-2">{current.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.body}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <Button size="sm" className="gap-1" onClick={handleNext}>
            {current.cta} <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
