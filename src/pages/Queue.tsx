import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Hash, User, Clock, Play, CheckCircle, XCircle, AlertTriangle, Monitor, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  waiting: { label: "Waiting", color: "bg-warning/10 text-warning", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-info/10 text-info", icon: Play },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive", icon: XCircle },
  no_show: { label: "No Show", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "bg-muted text-muted-foreground" },
  urgent: { label: "Urgent", color: "bg-warning/10 text-warning" },
  emergency: { label: "Emergency", color: "bg-destructive/10 text-destructive" },
};

// Swipeable card component for mobile
function SwipeableTokenCard({ token, onSwipeRight, onSwipeLeft }: { token: any; onSwipeRight: () => void; onSwipeLeft: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    setOffset(Math.max(-100, Math.min(100, diff)));
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (offset > 60) {
      onSwipeRight();
    } else if (offset < -60) {
      onSwipeLeft();
    }
    setOffset(0);
  }, [offset, onSwipeRight, onSwipeLeft]);

  const StatusIcon = statusConfig[token.status]?.icon || Clock;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe indicators */}
      <div className="absolute inset-0 flex">
        <div className={cn("flex-1 flex items-center justify-start pl-4 bg-info/20 transition-opacity", offset > 30 ? "opacity-100" : "opacity-0")}>
          <Play className="h-5 w-5 text-info" />
          <span className="text-xs font-medium text-info ml-1">In Progress</span>
        </div>
        <div className={cn("flex-1 flex items-center justify-end pr-4 bg-success/20 transition-opacity", offset < -30 ? "opacity-100" : "opacity-0")}>
          <span className="text-xs font-medium text-success mr-1">Complete</span>
          <CheckCircle className="h-5 w-5 text-success" />
        </div>
      </div>

      <Card
        ref={cardRef}
        className={cn(
          "shadow-card border-0 relative transition-transform",
          token.status === "in_progress" && "ring-2 ring-info",
          token.priority === "emergency" && "ring-2 ring-destructive",
          token.priority === "urgent" && "ring-2 ring-warning"
        )}
        style={{ transform: `translateX(${offset}px)`, transition: swiping ? "none" : "transform 0.3s ease" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-4 flex items-center gap-3 min-h-[72px]">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", token.status === "in_progress" ? "bg-info/10" : "bg-accent")}>
            <span className={cn("text-xl font-bold", token.status === "in_progress" ? "text-info" : "text-accent-foreground")}>
              #{token.token_number}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{token.patients?.full_name}</p>
              {token.priority !== "normal" && (
                <Badge className={cn(priorityConfig[token.priority]?.color, "text-[10px]")} variant="secondary">
                  {token.priority === "emergency" && <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />}
                  {priorityConfig[token.priority]?.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Dr. {token.profiles?.full_name || "Unassigned"}
              {token.counter_number && ` · ${token.counter_number}`}
            </p>
          </div>
          <Badge className={cn(statusConfig[token.status]?.color, "shrink-0")} variant="secondary">
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig[token.status]?.label}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

export default function QueuePage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState(false);
  const [form, setForm] = useState({ patient_id: "", provider_id: "", priority: "normal", counter_number: "", notes: "" });

  const { data: patients } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId).order("full_name");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: providers } = useQuery({
    queryKey: ["providers-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, role")
        .eq("clinic_id", clinicId)
        .in("role", ["owner", "dentist", "hygienist"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const today = new Date().toISOString().split("T")[0];
  const { data: queue, isLoading } = useQuery({
    queryKey: ["queue", clinicId, today],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("queue_tokens")
        .select("*, patients(full_name), profiles:provider_id(full_name)")
        .eq("clinic_id", clinicId)
        .eq("queue_date", today)
        .order("token_number", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel("queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => {
        queryClient.invalidateQueries({ queryKey: ["queue", clinicId, today] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, today, queryClient]);

  const generateToken = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error("No clinic");
      const { data: nextNum } = await supabase.rpc("get_next_token_number", { p_clinic_id: clinicId, p_date: today });
      const { error } = await supabase.from("queue_tokens").insert({
        clinic_id: clinicId, patient_id: form.patient_id, provider_id: form.provider_id || null,
        token_number: nextNum ?? 1, priority: form.priority as any,
        counter_number: form.counter_number || null, notes: form.notes || null, queue_date: today,
      });
      if (error) throw error;
      return nextNum;
    },
    onSuccess: (tokenNum) => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      setOpen(false);
      setForm({ patient_id: "", provider_id: "", priority: "normal", counter_number: "", notes: "" });
      toast.success(`Token #${tokenNum} generated!`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "in_progress") updates.called_at = new Date().toISOString();
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("queue_tokens").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Status updated!");
    },
  });

  const waitingCount = queue?.filter((t: any) => t.status === "waiting").length ?? 0;
  const inProgressCount = queue?.filter((t: any) => t.status === "in_progress").length ?? 0;
  const completedCount = queue?.filter((t: any) => t.status === "completed").length ?? 0;
  const currentlyServing = queue?.filter((t: any) => t.status === "in_progress") ?? [];

  const tokenFormContent = (
    <form onSubmit={e => { e.preventDefault(); generateToken.mutate(); }} className="space-y-4">
      <div className="space-y-2">
        <Label>Patient *</Label>
        <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select patient" /></SelectTrigger>
          <SelectContent>{patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Assign Doctor</Label>
        <Select value={form.provider_id} onValueChange={v => setForm(f => ({ ...f, provider_id: v }))}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select doctor (optional)" /></SelectTrigger>
          <SelectContent>{providers?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.role})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Room / Counter</Label>
          <Input value={form.counter_number} onChange={e => setForm(f => ({ ...f, counter_number: e.target.value }))} placeholder="e.g. Room 1" className="h-11" />
        </div>
      </div>
      <Button type="submit" className="w-full h-12" disabled={generateToken.isPending || !form.patient_id}>
        {generateToken.isPending ? "Generating..." : "Generate Token"}
      </Button>
    </form>
  );

  // Display mode
  if (displayMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between bg-primary px-6 md:px-8 py-4">
          <h1 className="text-xl md:text-2xl font-heading font-bold text-primary-foreground">Queue Display</h1>
          <Button variant="secondary" onClick={() => setDisplayMode(false)}>Exit</Button>
        </div>
        <div className="flex-1 p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-auto">
          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-heading font-bold flex items-center gap-2">
              <Play className="h-5 w-5 md:h-6 md:w-6 text-info" /> Now Serving
            </h2>
            {currentlyServing.length === 0 ? (
              <p className="text-muted-foreground">No one being served</p>
            ) : currentlyServing.map((t: any) => (
              <Card key={t.id} className="border-2 border-info shadow-lg">
                <CardContent className="p-4 md:p-6 flex items-center gap-4 md:gap-6">
                  <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-info/10">
                    <span className="text-3xl md:text-4xl font-bold text-info">#{t.token_number}</span>
                  </div>
                  <div>
                    <p className="text-lg md:text-xl font-bold">{t.patients?.full_name}</p>
                    <p className="text-muted-foreground text-sm">Dr. {t.profiles?.full_name || "Unassigned"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-heading font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-warning" /> Waiting ({waitingCount})
            </h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {queue?.filter((t: any) => t.status === "waiting").map((t: any) => (
                <Card key={t.id} className={t.priority === "emergency" ? "border-2 border-destructive" : t.priority === "urgent" ? "border-2 border-warning" : "border-0 shadow-card"}>
                  <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-warning/10">
                      <span className="text-lg md:text-xl font-bold text-warning">#{t.token_number}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{t.patients?.full_name}</p>
                      <p className="text-sm text-muted-foreground">Dr. {t.profiles?.full_name || "Unassigned"}</p>
                    </div>
                    {t.priority !== "normal" && (
                      <Badge className={priorityConfig[t.priority]?.color}>{priorityConfig[t.priority]?.label}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeTokens = queue?.filter((t: any) => t.status !== "completed" && t.status !== "cancelled" && t.status !== "no_show") ?? [];
  const doneTokens = queue?.filter((t: any) => ["completed", "cancelled", "no_show"].includes(t.status)) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Queue</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Today's patient queue</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size={isMobile ? "icon" : "default"} onClick={() => setDisplayMode(true)}>
              <Monitor className={cn("h-4 w-4", !isMobile && "mr-2")} />
              {!isMobile && "Display Mode"}
            </Button>
            {isMobile ? (
              <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Token</Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader><DrawerTitle>Generate Queue Token</DrawerTitle></DrawerHeader>
                  <div className="px-4 pb-6">{tokenFormContent}</div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Generate Token</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Generate Queue Token</DialogTitle></DialogHeader>
                  {tokenFormContent}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-3">
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Waiting</p>
                <p className="text-xl md:text-2xl font-bold">{waitingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-info/10 shrink-0">
                <Play className="h-5 w-5 md:h-6 md:w-6 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-xl md:text-2xl font-bold">{inProgressCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-0">
            <CardContent className="p-3 md:p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-success/10 shrink-0">
                <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Done</p>
                <p className="text-xl md:text-2xl font-bold">{completedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile swipe hint */}
        {isMobile && activeTokens.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <ChevronRight className="h-3 w-3" /> Swipe right = In Progress · Swipe left = Complete
          </p>
        )}

        {/* Queue List */}
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8 text-sm">Loading queue...</p>
          ) : !activeTokens.length ? (
            <Card className="shadow-card border-0">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No tokens generated today. Tap "Token" to start.
              </CardContent>
            </Card>
          ) : activeTokens.map((token: any) => (
            isMobile && (token.status === "waiting" || token.status === "in_progress") ? (
              <SwipeableTokenCard
                key={token.id}
                token={token}
                onSwipeRight={() => {
                  if (token.status === "waiting") updateStatus.mutate({ id: token.id, status: "in_progress" });
                }}
                onSwipeLeft={() => {
                  if (token.status === "waiting" || token.status === "in_progress") updateStatus.mutate({ id: token.id, status: "completed" });
                }}
              />
            ) : (
              <Card key={token.id} className={cn("shadow-card border-0", token.status === "in_progress" && "ring-2 ring-info", token.priority === "emergency" && "ring-2 ring-destructive", token.priority === "urgent" && "ring-2 ring-warning")}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", token.status === "in_progress" ? "bg-info/10" : "bg-accent")}>
                      <span className={cn("text-2xl font-bold", token.status === "in_progress" ? "text-info" : "text-accent-foreground")}>
                        #{token.token_number}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{token.patients?.full_name}</p>
                        {token.priority !== "normal" && (
                          <Badge className={priorityConfig[token.priority]?.color} variant="secondary">
                            {token.priority === "emergency" && <AlertTriangle className="mr-1 h-3 w-3" />}
                            {priorityConfig[token.priority]?.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Dr. {token.profiles?.full_name || "Unassigned"}
                        {token.counter_number && ` · ${token.counter_number}`}
                        {" · "}
                        {new Date(token.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[token.status]?.color} variant="secondary">{statusConfig[token.status]?.label}</Badge>
                    {token.status === "waiting" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: token.id, status: "in_progress" })}>
                        <Play className="mr-1 h-3 w-3" /> Call
                      </Button>
                    )}
                    {token.status === "in_progress" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: token.id, status: "completed" })}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Complete
                      </Button>
                    )}
                    {(token.status === "waiting" || token.status === "in_progress") && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: token.id, status: "no_show" })}>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          ))}

          {/* Completed section */}
          {doneTokens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Completed / Others</h3>
              <div className="space-y-2">
                {doneTokens.map((token: any) => (
                  <Card key={token.id} className="shadow-card border-0 opacity-60">
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">#{token.token_number}</span>
                        <span className="text-sm text-muted-foreground">{token.patients?.full_name}</span>
                      </div>
                      <Badge className={statusConfig[token.status]?.color} variant="secondary">
                        {statusConfig[token.status]?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
