import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, X, Phone, MessageCircle, Package, Calendar,
  CreditCard, AlertTriangle, Loader2, RefreshCw, ClipboardList,
  ChevronDown, ChevronUp, Star, Users, Search, Sparkles, PartyPopper
} from "lucide-react";

const TASK_CONFIG: Record<string, { icon: React.ReactNode; color: string; dotColor: string; label: string; actionLabel: string; actionType: "call" | "whatsapp" | "done" }> = {
  LAB_READY: { icon: <Package className="w-4 h-4" />, dotColor: "bg-blue-500", color: "text-blue-600 bg-blue-50 dark:bg-blue-950", label: "Lab Ready", actionLabel: "Call", actionType: "call" },
  INCOMPLETE_TX: { icon: <Calendar className="w-4 h-4" />, dotColor: "bg-orange-500", color: "text-orange-600 bg-orange-50 dark:bg-orange-950", label: "Follow Up", actionLabel: "WhatsApp", actionType: "whatsapp" },
  RECALL_DUE: { icon: <MessageCircle className="w-4 h-4" />, dotColor: "bg-purple-500", color: "text-purple-600 bg-purple-50 dark:bg-purple-950", label: "6-Month Recall", actionLabel: "WhatsApp", actionType: "whatsapp" },
  PAYMENT_OVERDUE: { icon: <CreditCard className="w-4 h-4" />, dotColor: "bg-red-500", color: "text-red-600 bg-red-50 dark:bg-red-950", label: "Payment Due", actionLabel: "Call", actionType: "call" },
  EMI_DUE: { icon: <CreditCard className="w-4 h-4" />, dotColor: "bg-amber-500", color: "text-amber-600 bg-amber-50 dark:bg-amber-950", label: "EMI Due", actionLabel: "WhatsApp", actionType: "whatsapp" },
  CONFIRM_TOMORROW: { icon: <Calendar className="w-4 h-4" />, dotColor: "bg-emerald-500", color: "text-green-600 bg-green-50 dark:bg-green-950", label: "Confirm Appt", actionLabel: "WhatsApp", actionType: "whatsapp" },
  LOW_STOCK: { icon: <AlertTriangle className="w-4 h-4" />, dotColor: "bg-yellow-500", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950", label: "Low Stock", actionLabel: "Done", actionType: "done" },
  REVIEW_REQUEST: { icon: <Star className="w-4 h-4" />, dotColor: "bg-yellow-400", color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950", label: "Review Request", actionLabel: "WhatsApp", actionType: "whatsapp" },
  REFERRAL_CAMPAIGN: { icon: <Users className="w-4 h-4" />, dotColor: "bg-pink-500", color: "text-pink-600 bg-pink-50 dark:bg-pink-950", label: "Referral Campaign", actionLabel: "WhatsApp", actionType: "whatsapp" },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-muted text-muted-foreground",
};

const FILTER_GROUPS = [
  {
    label: "Clinical",
    tabs: [
      { value: "LAB_READY", label: "Lab Ready" },
      { value: "INCOMPLETE_TX", label: "Follow Up" },
      { value: "RECALL_DUE", label: "Recall" },
      { value: "CONFIRM_TOMORROW", label: "Confirmations" },
    ],
  },
  {
    label: "Growth",
    tabs: [
      { value: "REVIEW_REQUEST", label: "Reviews" },
      { value: "REFERRAL_CAMPAIGN", label: "Referrals" },
    ],
  },
  {
    label: "Admin",
    tabs: [
      { value: "PAYMENT_OVERDUE", label: "Payments" },
      { value: "EMI_DUE", label: "EMI" },
      { value: "LOW_STOCK", label: "Low Stock" },
    ],
  },
];

export default function TasksPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: todos, isLoading } = useQuery({
    queryKey: ["tasks-page", clinicId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_todos")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("created_at", today + "T00:00:00Z")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "dismissed" }) => {
      const update: any = { status };
      if (status === "completed") update.completed_at = new Date().toISOString();
      if (status === "dismissed") update.dismissed_at = new Date().toISOString();
      const { error } = await supabase.from("daily_todos").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-page"] });
      queryClient.invalidateQueries({ queryKey: ["daily-todos"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-daily-todos", {
        body: { source: "manual" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.generated} tasks`);
      queryClient.invalidateQueries({ queryKey: ["tasks-page"] });
      queryClient.invalidateQueries({ queryKey: ["daily-todos"] });
    },
    onError: (err: any) => toast.error("Failed: " + err.message),
  });

  const handleAction = (todo: any) => {
    const config = TASK_CONFIG[todo.task_type];
    if (!config) return;

    if (config.actionType === "call" && todo.patient_phone) {
      window.open(`tel:${todo.patient_phone}`, "_self");
      updateTodo.mutate({ id: todo.id, status: "completed" });
    } else if (config.actionType === "whatsapp" && todo.patient_phone) {
      const phone = todo.patient_phone.replace(/[^0-9]/g, "");
      const text = encodeURIComponent(todo.message);
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
      updateTodo.mutate({ id: todo.id, status: "completed" });
    } else {
      updateTodo.mutate({ id: todo.id, status: "completed" });
    }
  };

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filteredTodos = (todos ?? []).filter(t => {
    if (activeFilter !== "all" && t.task_type !== activeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.message?.toLowerCase().includes(q) || t.patient_name?.toLowerCase().includes(q) || t.patient_phone?.includes(q);
    }
    return true;
  });

  const pending = filteredTodos.filter(t => t.status === "pending")
    .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3));
  const completed = filteredTodos.filter(t => t.status !== "pending");

  const countByType = (todos ?? []).reduce((acc, t) => {
    if (t.status === "pending") {
      acc[t.task_type] = (acc[t.task_type] || 0) + 1;
      acc["all"] = (acc["all"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
        {/* Unified Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <ClipboardList className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg md:text-xl font-bold text-foreground">
                  Today's Tasks
                </h1>
                {(countByType["all"] ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                    {countByType["all"]}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {/* All chip */}
            <button
              onClick={() => setActiveFilter("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              All
              {(countByType["all"] ?? 0) > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold ${activeFilter === "all" ? "opacity-80" : ""}`}>
                  {countByType["all"]}
                </span>
              )}
            </button>

            {/* Grouped chips with subtle separators */}
            {FILTER_GROUPS.map((group, gi) => (
              <div key={group.label} className="contents">
                {gi > 0 && <div className="w-px h-6 bg-border self-center mx-1 hidden sm:block" />}
                {group.tabs.map(tab => {
                  const config = TASK_CONFIG[tab.value];
                  const count = countByType[tab.value] ?? 0;
                  const isActive = activeFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveFilter(tab.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${config?.dotColor ?? "bg-gray-400"}`} />
                      {tab.label}
                      {count > 0 && (
                        <span className={`text-[10px] font-bold ${isActive ? "opacity-80" : "text-foreground"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pending.length === 0 && completed.length === 0 ? (
          /* Enhanced Empty State */
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/60 flex items-center justify-center mb-4">
                <PartyPopper className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
                You're all caught up! 🎉
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                No pending tasks for today. Generate tasks to check for new follow-ups, recalls, and reminders.
              </p>
              <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Tasks
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Pending tasks */}
            <div className="space-y-2">
              {pending.map(todo => {
                const config = TASK_CONFIG[todo.task_type] ?? TASK_CONFIG.LOW_STOCK;
                return (
                  <Card key={todo.id} className="group border hover:shadow-md transition-all duration-200 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Priority color stripe */}
                        <div className={`w-1 shrink-0 ${
                          todo.priority === "urgent" ? "bg-red-500" :
                          todo.priority === "high" ? "bg-orange-500" :
                          todo.priority === "medium" ? "bg-yellow-500" : "bg-muted"
                        }`} />
                        <div className="flex items-start gap-3 p-3 md:p-4 flex-1 min-w-0">
                          <div className={`mt-0.5 p-2 rounded-xl ${config.color} shrink-0`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{todo.message}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {todo.patient_name && (
                                <span className="text-xs text-muted-foreground font-medium">{todo.patient_name}</span>
                              )}
                              {todo.patient_phone && (
                                <span className="text-xs text-muted-foreground">{todo.patient_phone}</span>
                              )}
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[todo.priority] || ""}`}>
                                {todo.priority}
                              </Badge>
                            </div>
                          </div>
                          {/* Actions - stack on mobile, row on desktop */}
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleAction(todo)}
                              disabled={updateTodo.isPending}
                              className="gap-1.5 h-8 text-xs"
                            >
                              {config.actionType === "call" && <Phone className="w-3.5 h-3.5" />}
                              {config.actionType === "whatsapp" && <MessageCircle className="w-3.5 h-3.5" />}
                              {config.actionType === "done" && <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{config.actionLabel}</span>
                            </Button>
                            {config.actionType !== "done" && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateTodo.mutate({ id: todo.id, status: "completed" })}
                                disabled={updateTodo.isPending}
                                title="Mark as done"
                              >
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => updateTodo.mutate({ id: todo.id, status: "dismissed" })}
                              disabled={updateTodo.isPending}
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Completed section */}
            {completed.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {completed.length} completed / dismissed
                </button>
                {showCompleted && (
                  <div className="space-y-1.5 mt-3">
                    {completed.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 opacity-60">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-sm line-through truncate flex-1">{todo.message}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{todo.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
