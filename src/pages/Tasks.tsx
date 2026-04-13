import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, X, Phone, MessageCircle, Package, Calendar,
  CreditCard, AlertTriangle, Loader2, RefreshCw, ClipboardList,
  ChevronDown, ChevronUp, Star, Users, Search, Filter
} from "lucide-react";

const TASK_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string; actionLabel: string; actionType: "call" | "whatsapp" | "done" }> = {
  LAB_READY: { icon: <Package className="w-4 h-4" />, color: "text-blue-600 bg-blue-50 dark:bg-blue-950", label: "Lab Ready", actionLabel: "Call", actionType: "call" },
  INCOMPLETE_TX: { icon: <Calendar className="w-4 h-4" />, color: "text-orange-600 bg-orange-50 dark:bg-orange-950", label: "Follow Up", actionLabel: "WhatsApp", actionType: "whatsapp" },
  RECALL_DUE: { icon: <MessageCircle className="w-4 h-4" />, color: "text-purple-600 bg-purple-50 dark:bg-purple-950", label: "6-Month Recall", actionLabel: "WhatsApp", actionType: "whatsapp" },
  PAYMENT_OVERDUE: { icon: <CreditCard className="w-4 h-4" />, color: "text-red-600 bg-red-50 dark:bg-red-950", label: "Payment Due", actionLabel: "Call", actionType: "call" },
  EMI_DUE: { icon: <CreditCard className="w-4 h-4" />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950", label: "EMI Due", actionLabel: "WhatsApp", actionType: "whatsapp" },
  CONFIRM_TOMORROW: { icon: <Calendar className="w-4 h-4" />, color: "text-green-600 bg-green-50 dark:bg-green-950", label: "Confirm Appt", actionLabel: "WhatsApp", actionType: "whatsapp" },
  LOW_STOCK: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950", label: "Low Stock", actionLabel: "Done", actionType: "done" },
  REVIEW_REQUEST: { icon: <Star className="w-4 h-4" />, color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950", label: "Review Request", actionLabel: "WhatsApp", actionType: "whatsapp" },
  REFERRAL_CAMPAIGN: { icon: <Users className="w-4 h-4" />, color: "text-pink-600 bg-pink-50 dark:bg-pink-950", label: "Referral Campaign", actionLabel: "WhatsApp", actionType: "whatsapp" },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-muted text-muted-foreground",
};

const ALL_TABS = [
  { value: "all", label: "All Tasks" },
  { value: "LAB_READY", label: "Lab Ready" },
  { value: "INCOMPLETE_TX", label: "Follow Up" },
  { value: "RECALL_DUE", label: "Recall" },
  { value: "REVIEW_REQUEST", label: "Reviews" },
  { value: "REFERRAL_CAMPAIGN", label: "Referrals" },
  { value: "PAYMENT_OVERDUE", label: "Payments" },
  { value: "EMI_DUE", label: "EMI" },
  { value: "CONFIRM_TOMORROW", label: "Confirmations" },
  { value: "LOW_STOCK", label: "Low Stock" },
];

export default function TasksPage() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
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
    if (activeTab !== "all" && t.task_type !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.message?.toLowerCase().includes(q) || t.patient_name?.toLowerCase().includes(q) || t.patient_phone?.includes(q);
    }
    return true;
  });

  const pending = filteredTodos.filter(t => t.status === "pending")
    .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3));
  const completed = filteredTodos.filter(t => t.status !== "pending");

  // Count per tab (unfiltered by search)
  const countByType = (todos ?? []).reduce((acc, t) => {
    if (t.status === "pending") {
      acc[t.task_type] = (acc[t.task_type] || 0) + 1;
      acc["all"] = (acc["all"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Today's Tasks
              {countByType["all"] > 0 && (
                <Badge variant="secondary" className="text-sm">{countByType["all"]}</Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">Auto-generated clinical & administrative tasks for today</p>
          </div>
          <Button
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
            Regenerate Tasks
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs for task types */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="w-max gap-1">
              {ALL_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 shrink-0">
                  {tab.label}
                  {(countByType[tab.value] ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{countByType[tab.value]}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Single content area for all tabs */}
          {ALL_TABS.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pending.length === 0 && completed.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-500/40 mb-3" />
                    <p className="text-muted-foreground">No {tab.value === "all" ? "" : tab.label + " "}tasks for today</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => regenerateMutation.mutate()}>
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
                        <Card key={todo.id} className="border hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 p-2 rounded-lg ${config.color}`}>
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
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Primary action */}
                                <Button
                                  size="sm"
                                  onClick={() => handleAction(todo)}
                                  disabled={updateTodo.isPending}
                                  className="gap-1.5"
                                >
                                  {config.actionType === "call" && <Phone className="w-3.5 h-3.5" />}
                                  {config.actionType === "whatsapp" && <MessageCircle className="w-3.5 h-3.5" />}
                                  {config.actionType === "done" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {config.actionLabel}
                                </Button>
                                {/* Mark done */}
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
                                {/* Dismiss */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground"
                                  onClick={() => updateTodo.mutate({ id: todo.id, status: "dismissed" })}
                                  disabled={updateTodo.isPending}
                                  title="Dismiss"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
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
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
