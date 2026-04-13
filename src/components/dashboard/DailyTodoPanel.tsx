import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CheckCircle2, X, Phone, MessageCircle, Package, Calendar,
  CreditCard, AlertTriangle, Loader2, RefreshCw, ClipboardList,
  ChevronDown, ChevronUp
} from "lucide-react";

const TASK_CONFIG: Record<string, { icon: React.ReactNode; color: string; actionLabel: string; actionType: "call" | "whatsapp" | "done" }> = {
  LAB_READY: { icon: <Package className="w-4 h-4" />, color: "text-blue-600 bg-blue-50 dark:bg-blue-950", actionLabel: "Call", actionType: "call" },
  INCOMPLETE_TX: { icon: <Calendar className="w-4 h-4" />, color: "text-orange-600 bg-orange-50 dark:bg-orange-950", actionLabel: "Follow Up", actionType: "whatsapp" },
  RECALL_DUE: { icon: <MessageCircle className="w-4 h-4" />, color: "text-purple-600 bg-purple-50 dark:bg-purple-950", actionLabel: "WhatsApp", actionType: "whatsapp" },
  PAYMENT_OVERDUE: { icon: <CreditCard className="w-4 h-4" />, color: "text-red-600 bg-red-50 dark:bg-red-950", actionLabel: "Call", actionType: "call" },
  EMI_DUE: { icon: <CreditCard className="w-4 h-4" />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950", actionLabel: "WhatsApp", actionType: "whatsapp" },
  CONFIRM_TOMORROW: { icon: <Calendar className="w-4 h-4" />, color: "text-green-600 bg-green-50 dark:bg-green-950", actionLabel: "Confirm", actionType: "whatsapp" },
  LOW_STOCK: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950", actionLabel: "Done", actionType: "done" },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-muted text-muted-foreground",
};

export default function DailyTodoPanel() {
  const { clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: todos, isLoading } = useQuery({
    queryKey: ["daily-todos", clinicId, today],
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
      queryClient.invalidateQueries({ queryKey: ["daily-todos"] });
    },
    onError: (err: any) => toast.error("Failed to generate: " + err.message),
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

  const pending = todos?.filter(t => t.status === "pending") ?? [];
  const completed = todos?.filter(t => t.status !== "pending") ?? [];

  // Sort by priority: urgent > high > medium > low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  pending.sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3));

  return (
    <Card className="shadow-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <ClipboardList className="h-5 w-5 text-primary" />
            Today's Tasks
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{pending.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="h-8 text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 && completed.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-500/40 mb-2" />
            <p className="text-sm text-muted-foreground">All caught up! No tasks for today.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => regenerateMutation.mutate()}>
              Generate Tasks
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {pending.map(todo => {
                const config = TASK_CONFIG[todo.task_type] ?? TASK_CONFIG.LOW_STOCK;
                return (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-md ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{todo.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {todo.patient_phone && (
                          <span className="text-[10px] text-muted-foreground">{todo.patient_phone}</span>
                        )}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[todo.priority] || ""}`}>
                          {todo.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {todo.task_type.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-2"
                        onClick={() => handleAction(todo)}
                        disabled={updateTodo.isPending}
                      >
                        {config.actionType === "call" && <Phone className="w-3 h-3 mr-1" />}
                        {config.actionType === "whatsapp" && <MessageCircle className="w-3 h-3 mr-1" />}
                        {config.actionType === "done" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {config.actionLabel}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => updateTodo.mutate({ id: todo.id, status: "dismissed" })}
                        disabled={updateTodo.isPending}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completed/Dismissed section */}
            {completed.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {completed.length} completed/dismissed
                </button>
                {showCompleted && (
                  <div className="space-y-1.5 mt-2">
                    {completed.map(todo => (
                      <div key={todo.id} className="flex items-center gap-2 p-2 rounded-md opacity-50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="text-xs line-through truncate">{todo.message}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                          {todo.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
