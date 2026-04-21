import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, ChevronLeft, ChevronRight, Upload, Download, FileSpreadsheet,
  Facebook, Instagram, Twitter, Linkedin, CalendarDays, List, Grid3x3, BarChart3,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, addWeeks, subWeeks, isSameMonth, isToday, addDays } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PostEditor } from "@/components/social/PostEditor";
import { SocialWebhooksPanel } from "@/components/social/SocialWebhooksPanel";
import { SocialAnalyticsDashboard } from "@/components/social/SocialAnalyticsDashboard";

const PLATFORM_ICONS: Record<string, any> = {
  Facebook, Instagram, Twitter, LinkedIn: Linkedin,
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  posted: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-destructive/15 text-destructive",
};

export default function SocialCalendar() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const clinicId = profile?.clinic_id;
  const [view, setView] = useState<"month" | "week" | "list" | "analytics">("month");
  const [cursor, setCursor] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>();

  const { data: clinic } = useQuery({
    queryKey: ["clinic-info", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("name, logo_url").eq("id", clinicId!).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const range = useMemo(() => {
    if (view === "month") {
      return { start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) };
    }
    if (view === "week") {
      return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
    }
    return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
  }, [view, cursor]);

  const { data: posts = [], refetch } = useQuery({
    queryKey: ["social-posts", clinicId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("clinic_id", clinicId!)
        .gte("scheduled_at", range.start.toISOString())
        .lte("scheduled_at", range.end.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId,
  });

  const days = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range]);

  const postsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    posts.forEach(p => {
      const k = format(new Date(p.scheduled_at), "yyyy-MM-dd");
      (map[k] ||= []).push(p);
    });
    return map;
  }, [posts]);

  const openNew = (date?: Date) => {
    setEditingId(null);
    setEditingDate(date);
    setEditorOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setEditingDate(undefined);
    setEditorOpen(true);
  };

  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCursor(c => dir === 1 ? addMonths(c, 1) : subMonths(c, 1));
    else if (view === "week") setCursor(c => dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1));
    else setCursor(c => dir === 1 ? addMonths(c, 1) : subMonths(c, 1));
  };

  // Excel template download
  const downloadTemplate = () => {
    const rows = [
      {
        scheduled_at: "2026-05-01 10:00",
        platforms: "Facebook,Instagram",
        caption: "New smile, who dis? Book your free consultation today.",
        hashtags: "#dentist #smile #clinic",
        image_url: "https://example.com/image.jpg",
        campaign_name: "May Promo",
        cta_link: "https://yourclinic.com/book",
        target_audience: "Adults 25-45 local",
        boost_budget: 500,
        notes: "Run for 3 days",
        approval_status: "approved",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Posts");
    XLSX.writeFile(wb, "social-content-template.xlsx");
  };

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinicId) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      const payload = rows.map(r => ({
        clinic_id: clinicId,
        scheduled_at: new Date(r.scheduled_at).toISOString(),
        platforms: String(r.platforms || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        caption: r.caption || "",
        hashtags: r.hashtags || null,
        image_url: r.image_url || null,
        campaign_name: r.campaign_name || null,
        cta_link: r.cta_link || null,
        target_audience: r.target_audience || null,
        boost_budget: Number(r.boost_budget) || 0,
        notes: r.notes || null,
        approval_status: r.approval_status || "pending",
        status: "draft",
      }));
      const { error } = await supabase.from("social_posts").insert(payload);
      if (error) throw error;
      toast.success(`Imported ${payload.length} posts`);
      refetch();
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const exportXlsx = () => {
    const rows = posts.map(p => ({
      scheduled_at: format(new Date(p.scheduled_at), "yyyy-MM-dd HH:mm"),
      platforms: (p.platforms || []).join(","),
      caption: p.caption,
      hashtags: p.hashtags,
      image_url: p.image_url,
      campaign_name: p.campaign_name,
      cta_link: p.cta_link,
      target_audience: p.target_audience,
      boost_budget: p.boost_budget,
      notes: p.notes,
      approval_status: p.approval_status,
      status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Posts");
    XLSX.writeFile(wb, `social-posts-${format(cursor, "yyyy-MM")}.xlsx`);
  };

  const headerLabel = view === "week"
    ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
    : format(cursor, "MMMM yyyy");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Social Content Calendar</h1>
          <p className="text-sm text-muted-foreground">Plan, preview & schedule posts across all platforms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Template
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4 mr-1" /> Import Excel</span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={() => openNew()}><Plus className="w-4 h-4 mr-1" /> New Post</Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v: any) => setView(v)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="month"><Grid3x3 className="w-4 h-4 mr-1" /> Month</TabsTrigger>
            <TabsTrigger value="week"><CalendarDays className="w-4 h-4 mr-1" /> Week</TabsTrigger>
            <TabsTrigger value="list"><List className="w-4 h-4 mr-1" /> List</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" /> Analytics</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="font-medium min-w-[10rem] text-center">{headerLabel}</div>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          </div>
        </div>

        <TabsContent value="month" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} className="text-xs font-medium text-muted-foreground p-2 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr">
                {days.map((d, i) => {
                  const k = format(d, "yyyy-MM-dd");
                  const dayPosts = postsByDay[k] || [];
                  const inMonth = isSameMonth(d, cursor);
                  return (
                    <div
                      key={i}
                      className={`min-h-[110px] border-b border-r border-border p-1.5 cursor-pointer hover:bg-accent/30 ${!inMonth ? "bg-muted/20 opacity-60" : ""}`}
                      onClick={() => openNew(d)}
                    >
                      <div className={`text-xs font-medium mb-1 ${isToday(d) ? "text-primary" : ""}`}>
                        {format(d, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map(p => (
                          <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                            className={`text-[10px] px-1.5 py-1 rounded truncate flex items-center gap-1 ${STATUS_COLORS[p.status] || ""}`}
                          >
                            {(p.platforms || []).slice(0, 2).map((pl: string) => {
                              const Icon = PLATFORM_ICONS[pl];
                              return Icon ? <Icon key={pl} className="w-2.5 h-2.5 shrink-0" /> : null;
                            })}
                            <span className="truncate">{p.caption || "Untitled"}</span>
                          </div>
                        ))}
                        {dayPosts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayPosts.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 divide-x divide-border">
                {days.map(d => {
                  const k = format(d, "yyyy-MM-dd");
                  const dayPosts = postsByDay[k] || [];
                  return (
                    <div key={k} className="min-h-[400px] p-2">
                      <div className={`text-xs font-medium mb-2 ${isToday(d) ? "text-primary" : ""}`}>
                        {format(d, "EEE d")}
                      </div>
                      <div className="space-y-1.5">
                        {dayPosts.map(p => (
                          <div
                            key={p.id}
                            onClick={() => openEdit(p.id)}
                            className={`text-xs p-2 rounded cursor-pointer ${STATUS_COLORS[p.status]}`}
                          >
                            <div className="font-medium">{format(new Date(p.scheduled_at), "HH:mm")}</div>
                            <div className="flex gap-1 mt-1">
                              {(p.platforms || []).map((pl: string) => {
                                const Icon = PLATFORM_ICONS[pl];
                                return Icon ? <Icon key={pl} className="w-3 h-3" /> : null;
                              })}
                            </div>
                            <div className="truncate mt-1">{p.caption}</div>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => openNew(d)}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {posts.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No posts in this range. Click New Post to create one.</div>
              )}
              {posts.map(p => (
                <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-accent/30 cursor-pointer" onClick={() => openEdit(p.id)}>
                  <div className="text-xs text-muted-foreground w-32">{format(new Date(p.scheduled_at), "MMM d, HH:mm")}</div>
                  <div className="flex gap-1">
                    {(p.platforms || []).map((pl: string) => {
                      const Icon = PLATFORM_ICONS[pl];
                      return Icon ? <Icon key={pl} className="w-4 h-4" /> : null;
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{p.caption || "Untitled"}</div>
                    {p.campaign_name && <div className="text-xs text-muted-foreground">{p.campaign_name}</div>}
                  </div>
                  <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          {clinicId && <SocialAnalyticsDashboard clinicId={clinicId} />}
        </TabsContent>
      </Tabs>

      {clinicId && (
        <SocialWebhooksPanel clinicId={clinicId} />
      )}

      {clinicId && (
        <PostEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          postId={editingId}
          clinicId={clinicId}
          clinicName={clinic?.name}
          clinicLogo={clinic?.logo_url ?? undefined}
          defaultDate={editingDate}
          onSaved={() => qc.invalidateQueries({ queryKey: ["social-posts"] })}
        />
      )}
    </div>
  );
}
