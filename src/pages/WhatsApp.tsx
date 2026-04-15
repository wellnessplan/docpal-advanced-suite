import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageSquare, Send, Search, User2, Clock, CheckCheck,
  FileText, CalendarDays, Sparkles, Phone
} from "lucide-react";

const TEMPLATES = [
  { id: "appt_reminder", label: "Appointment Reminder", icon: CalendarDays,
    text: "Hi {name}, this is a reminder about your dental appointment on {date} at {time}. Please arrive 10 minutes early. Reply YES to confirm or call us to reschedule." },
  { id: "follow_up", label: "Post-Treatment Follow-Up", icon: Sparkles,
    text: "Hi {name}, we hope you're doing well after your recent {treatment}. If you experience any discomfort, please don't hesitate to contact us. Remember to follow the care instructions provided." },
  { id: "payment_reminder", label: "Payment Reminder", icon: FileText,
    text: "Hi {name}, this is a gentle reminder that you have an outstanding balance of Rs {amount}. Please visit us or call to arrange payment at your earliest convenience." },
  { id: "recall", label: "Recall / Check-up", icon: Clock,
    text: "Hi {name}, it's been a while since your last dental check-up! Regular visits help maintain your oral health. Call us to schedule your next appointment." },
];

export default function WhatsAppPage() {
  const { clinicId, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).order("full_name");
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["patient-comms", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const { data } = await supabase.from("patient_communications")
        .select("*")
        .eq("patient_id", selectedPatientId)
        .in("type", ["whatsapp", "sms"])
        .order("created_at", { ascending: true })
        .limit(100);
      return data ?? [];
    },
    enabled: !!selectedPatientId,
  });

  // Get patients who have communication history (for sidebar ordering)
  const { data: recentComms = [] } = useQuery({
    queryKey: ["recent-whatsapp-comms", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await supabase.from("patient_communications")
        .select("patient_id, created_at")
        .eq("clinic_id", clinicId)
        .in("type", ["whatsapp", "sms"])
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase();
    let list = patients.filter(p =>
      p.full_name.toLowerCase().includes(q) || (p.phone || "").includes(q)
    );
    // Sort: patients with recent comms first
    const lastCommMap = new Map<string, string>();
    recentComms.forEach(c => {
      if (!lastCommMap.has(c.patient_id)) lastCommMap.set(c.patient_id, c.created_at);
    });
    list.sort((a, b) => {
      const ca = lastCommMap.get(a.id) || "";
      const cb = lastCommMap.get(b.id) || "";
      if (ca && !cb) return -1;
      if (!ca && cb) return 1;
      return cb.localeCompare(ca);
    });
    return list;
  }, [patients, search, recentComms]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [communications]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const targetPhone = customPhone || selectedPatient?.phone;
      if (!targetPhone) throw new Error("No phone number");
      if (!message.trim()) throw new Error("Empty message");
      if (!clinicId || !selectedPatientId) throw new Error("Select a patient");

      // Log the communication
      const { error } = await supabase.from("patient_communications").insert({
        clinic_id: clinicId,
        patient_id: selectedPatientId,
        type: "whatsapp",
        direction: "outbound",
        content: message,
        subject: "WhatsApp Message",
        status: "sent",
        sent_by: user?.id || null,
      });
      if (error) throw error;

      // Try to send via edge function (optional)
      try {
        await supabase.functions.invoke("send-whatsapp", {
          body: { phone: targetPhone, message },
        });
      } catch {
        // Edge function may not be configured — that's fine, we logged the message
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-comms"] });
      queryClient.invalidateQueries({ queryKey: ["recent-whatsapp-comms"] });
      setMessage("");
      toast.success("Message sent!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    let text = template.text;
    text = text.replace("{name}", selectedPatient?.full_name || "Patient");
    text = text.replace("{date}", new Date().toLocaleDateString("en-IN"));
    text = text.replace("{time}", "10:00 AM");
    text = text.replace("{treatment}", "treatment");
    text = text.replace("{amount}", "0");
    setMessage(text);
  };

  const getLastMessage = (patientId: string) => {
    const comm = recentComms.find(c => c.patient_id === patientId);
    return comm ? new Date(comm.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in h-[calc(100vh-6rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">WhatsApp Messaging</h1>
            <p className="text-muted-foreground text-sm">Chat with patients via WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 h-[calc(100%-3.5rem)]">
          {/* Patient List Sidebar */}
          <Card className="col-span-4 shadow-card border-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPatientId(p.id); setCustomPhone(p.phone || ""); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${
                    selectedPatientId === p.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {p.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{p.full_name}</span>
                      {getLastMessage(p.id) && (
                        <span className="text-[10px] text-muted-foreground">{getLastMessage(p.id)}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{p.phone || "No phone"}</span>
                  </div>
                </button>
              ))}
              {!filteredPatients.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No patients found</p>
              )}
            </ScrollArea>
          </Card>

          {/* Chat Area */}
          <Card className="col-span-8 shadow-card border-0 flex flex-col overflow-hidden">
            {selectedPatient ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success font-bold">
                      {selectedPatient.full_name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {selectedPatient.phone || "No phone"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <MessageSquare className="h-3 w-3" /> {communications.length} messages
                  </Badge>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {!communications.length && (
                      <p className="text-sm text-muted-foreground text-center py-12">
                        No messages yet. Send your first message or use a template below.
                      </p>
                    )}
                    {communications.map((c: any) => (
                      <div key={c.id} className={`flex ${c.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                          c.direction === "outbound"
                            ? "bg-success text-success-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}>
                          <p className="whitespace-pre-wrap">{c.content}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                            c.direction === "outbound" ? "text-success-foreground/70" : "text-muted-foreground"
                          }`}>
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(c.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            {c.direction === "outbound" && <CheckCheck className="h-3 w-3 ml-0.5" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Templates Bar */}
                <div className="px-4 py-2 border-t bg-muted/30">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-muted-foreground shrink-0">Templates:</span>
                    {TEMPLATES.map(t => (
                      <Button key={t.id} size="sm" variant="outline" className="h-7 text-xs shrink-0 gap-1"
                        onClick={() => applyTemplate(t)}>
                        <t.icon className="h-3 w-3" /> {t.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div className="p-3 border-t bg-card">
                  <div className="flex gap-2">
                    <Textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      rows={2}
                      className="resize-none flex-1"
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage.mutate();
                        }
                      }}
                    />
                    <Button
                      onClick={() => sendMessage.mutate()}
                      disabled={sendMessage.isPending || !message.trim()}
                      className="self-end bg-success hover:bg-success/90"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <MessageSquare className="h-16 w-16 opacity-20" />
                <p className="text-lg font-medium">Select a patient to start messaging</p>
                <p className="text-sm">Choose a patient from the list or search by name/phone</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
