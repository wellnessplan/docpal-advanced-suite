import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone, MessageCircle, CalendarDays, Clock, User2, Stethoscope,
  CheckCircle2, XCircle, FileText, Loader2, PlayCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  scheduled: "border-primary/40 text-primary bg-primary/5",
  confirmed: "border-primary/40 text-primary bg-primary/5",
  in_progress: "border-warning/40 text-warning bg-warning/5",
  completed: "border-success/40 text-success bg-success/5",
  cancelled: "border-destructive/40 text-destructive bg-destructive/5",
  no_show: "border-muted-foreground/40 text-muted-foreground bg-muted",
};

interface AppointmentDetailsSheetProps {
  apt: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onView?: (apt: any) => void;
  onStatusChange?: (apt: any, status: string) => void;
  onCancel?: (apt: any) => void;
  isMutating?: boolean;
}

export function AppointmentDetailsSheet({
  apt, open, onOpenChange, onView, onStatusChange, onCancel, isMutating,
}: AppointmentDetailsSheetProps) {
  if (!apt) return null;
  const phone = apt.patients?.phone?.replace(/\D/g, "");
  const time = apt.appointment_time
    ? format(new Date(`2000-01-01T${apt.appointment_time}`), "h:mm a")
    : "—";
  const date = apt.appointment_date
    ? format(new Date(apt.appointment_date + "T00:00:00"), "EEE, dd MMM yyyy")
    : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-4 pb-6 pt-4 max-h-[85vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden />
        <SheetHeader className="text-left">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-base font-bold text-primary-foreground shrink-0">
              {(apt.patients?.full_name || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-heading truncate">
                {apt.patients?.full_name || "Patient"}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] capitalize", statusStyle[apt.status] || "")}
                >
                  {apt.status?.replace(/_/g, " ")}
                </Badge>
                {isMutating && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> updating…
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Details grid */}
        <div className="mt-4 space-y-2 text-sm">
          <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Date" value={date} />
          <DetailRow icon={<Clock className="h-4 w-4" />} label="Time" value={`${time} · ${apt.duration_minutes || 30} min`} />
          <DetailRow icon={<Stethoscope className="h-4 w-4" />} label="Type" value={apt.type || "—"} />
          {apt.provider?.full_name && (
            <DetailRow icon={<User2 className="h-4 w-4" />} label="Doctor" value={apt.provider.full_name} />
          )}
          {apt.patients?.phone && (
            <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={apt.patients.phone} />
          )}
          {apt.notes && (
            <DetailRow icon={<FileText className="h-4 w-4 mt-0.5" />} label="Notes" value={apt.notes} />
          )}
        </div>

        <Separator className="my-4" />

        {/* Quick contact */}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" disabled={!phone}>
            <a href={phone ? `tel:${phone}` : undefined}>
              <Phone className="h-4 w-4 mr-1.5" /> Call
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!phone}>
            <a
              href={phone ? `https://wa.me/${phone}` : undefined}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
            </a>
          </Button>
        </div>

        {/* Status actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {apt.status !== "in_progress" && apt.status !== "completed" && apt.status !== "cancelled" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isMutating}
              onClick={() => onStatusChange?.(apt, "in_progress")}
            >
              <PlayCircle className="h-4 w-4 mr-1.5" /> Start
            </Button>
          )}
          {apt.status !== "completed" && apt.status !== "cancelled" && (
            <Button
              size="sm"
              disabled={isMutating}
              onClick={() => onStatusChange?.(apt, "completed")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark complete
            </Button>
          )}
          {apt.status !== "cancelled" && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30"
              disabled={isMutating}
              onClick={() => onCancel?.(apt)}
            >
              <XCircle className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView?.(apt)}
            className="col-span-2"
          >
            Open patient profile
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
