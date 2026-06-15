import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, ChevronLeft, ChevronRight, Upload, Download, FileSpreadsheet,
  Facebook, Instagram, Twitter, Linkedin, CalendarDays, List, Grid3x3, BarChart3,
  ArrowLeft, Home, Info, ChevronDown, Image as ImageIcon, Video,
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

  // Commit a reschedule + show undo toast
  const commitReschedule = async (postId: string, prevIso: string, nextIso: string) => {
    const { error } = await supabase
      .from("social_posts")
      .update({ scheduled_at: nextIso })
      .eq("id", postId);
    if (error) { toast.error("Reschedule failed: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["social-posts"] });
    refetch();
    toast.success(`Moved to ${format(new Date(nextIso), "MMM d, HH:mm")}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: e2 } = await supabase
            .from("social_posts")
            .update({ scheduled_at: prevIso })
            .eq("id", postId);
          if (e2) toast.error("Undo failed: " + e2.message);
          else {
            toast.success("Reschedule undone");
            qc.invalidateQueries({ queryKey: ["social-posts"] });
            refetch();
          }
        },
      },
      duration: 8000,
    });
  };

  // Drag-to-reschedule: keep the post's original time-of-day, swap the date.
  // Detects same-platform conflicts on the target day and asks before committing.
  const handleReschedule = async (postId: string, newDay: Date) => {
    const post = posts.find((p: any) => p.id === postId);
    if (!post) return;
    const orig = new Date(post.scheduled_at);
    const next = new Date(newDay);
    next.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    if (next.getTime() === orig.getTime()) return;

    // Conflict scan: other posts on same calendar day sharing any platform
    const dayKey = format(next, "yyyy-MM-dd");
    const sameDay = (postsByDay[dayKey] || []).filter((p: any) => p.id !== postId);
    const myPlatforms: string[] = post.platforms || [];
    const conflicts = sameDay.filter((p: any) =>
      (p.platforms || []).some((pl: string) => myPlatforms.includes(pl))
    );

    if (conflicts.length > 0) {
      const shared = Array.from(new Set(
        conflicts.flatMap((c: any) => (c.platforms || []).filter((pl: string) => myPlatforms.includes(pl)))
      )).join(", ");
      const times = conflicts
        .map((c: any) => format(new Date(c.scheduled_at), "HH:mm"))
        .join(", ");
      toast.warning(
        `${conflicts.length} other post${conflicts.length > 1 ? "s" : ""} on ${format(next, "MMM d")} share ${shared} (${times})`,
        {
          description: "Multiple same-platform posts on one day can hurt reach.",
          duration: 12000,
          action: {
            label: "Move anyway",
            onClick: () => commitReschedule(postId, orig.toISOString(), next.toISOString()),
          },
          cancel: { label: "Cancel", onClick: () => {} },
        }
      );
      return;
    }

    await commitReschedule(postId, orig.toISOString(), next.toISOString());
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

  // Robust date parser — handles Excel serial numbers, "YYYY-MM-DD HH:mm",
  // ISO strings, and Date objects.
  const parseExcelDate = (val: any): Date | null => {
    if (val == null || val === "") return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    // Excel serial number (days since 1899-12-30)
    if (typeof val === "number" && isFinite(val)) {
      const ms = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    let s = String(val).trim();
    // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" so Safari/Firefox parse it
    if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(s)) s = s.replace(" ", "T");
    // "YYYY-MM-DD" alone — append midday so timezone shifts don't move the day
    else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = s + "T12:00";
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinicId) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const skipped: string[] = [];
      const payload: any[] = [];
      let earliest: Date | null = null;

      rows.forEach((r, idx) => {
        const dt = parseExcelDate(r.scheduled_at);
        if (!dt) {
          skipped.push(`Row ${idx + 2}: invalid scheduled_at "${r.scheduled_at}"`);
          return;
        }
        const platforms = String(r.platforms || "")
          .split(",").map((s: string) => s.trim()).filter(Boolean);
        if (platforms.length === 0) {
          skipped.push(`Row ${idx + 2}: no platforms`);
          return;
        }
        if (!earliest || dt < earliest) earliest = dt;
        payload.push({
          clinic_id: clinicId,
          scheduled_at: dt.toISOString(),
          platforms,
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
        });
      });

      if (payload.length === 0) {
        toast.error("Nothing to import. " + (skipped[0] ?? "Check your file."));
        return;
      }

      const { error } = await supabase.from("social_posts").insert(payload);
      if (error) throw error;

      // Jump the calendar to the earliest imported post so the user sees it immediately
      if (earliest) setCursor(earliest);

      const msg = skipped.length
        ? `Imported ${payload.length} posts • Skipped ${skipped.length}`
        : `Imported ${payload.length} posts`;
      toast.success(msg);
      if (skipped.length) console.warn("Skipped rows:", skipped);

      qc.invalidateQueries({ queryKey: ["social-posts"] });
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
      {/* Back / Home navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="h-8 px-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <span className="opacity-50">/</span>
        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
          <Link to="/dashboard"><Home className="w-4 h-4 mr-1" /> Dashboard</Link>
        </Button>
        <span className="opacity-50">/</span>
        <span className="text-foreground">Social Calendar</span>
      </div>

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

      {/* How webhooks work — collapsible explainer */}
      <Collapsible>
        <Card className="border-primary/20 bg-primary/5">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="w-4 h-4 text-primary" />
                How webhooks post your content
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
              <p><strong className="text-foreground">1. Create or import</strong> — Build a post in the editor or bulk-import from Excel. Attach an image/video and pick the platforms (Facebook, Instagram, Twitter/X, LinkedIn).</p>
              <p><strong className="text-foreground">2. Approve</strong> — A manager opens the post and clicks <em>Approve</em>. Posts that aren't approved are blocked from firing.</p>
              <p><strong className="text-foreground">3. Configure webhooks</strong> — In the <em>Webhooks</em> panel below, add one URL per platform (Zapier, Make, n8n, or your own endpoint). Each platform fires only to its matching webhook.</p>
              <p><strong className="text-foreground">4. Schedule & fire</strong> — Click <em>Schedule & Fire</em> on an approved post; our edge function sends a JSON payload (caption, hashtags, media URL, CTA, campaign, scheduled time) to your webhook(s). Your automation tool then publishes to the actual social account.</p>
              <p><strong className="text-foreground">5. Track</strong> — Delivery status (success/failed, HTTP code) appears in the <em>Analytics</em> tab along with clicks, impressions and engagement once your automation reports them back.</p>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove("bg-primary/10")}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("bg-primary/10");
                        const id = e.dataTransfer.getData("text/post-id");
                        if (id) handleReschedule(id, d);
                      }}
                    >
                      <div className={`text-xs font-medium mb-1 ${isToday(d) ? "text-primary" : ""}`}>
                        {format(d, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map(p => {
                          const thumb = p.media_url || p.image_url;
                          const isVideo = p.media_type === 'video';
                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/post-id", p.id); e.dataTransfer.effectAllowed = "move"; }}
                              onClick={(e) => { e.stopPropagation(); openEdit(p.id); }}
                              className={`text-[10px] px-1 py-0.5 rounded flex items-center gap-1 cursor-grab active:cursor-grabbing ${STATUS_COLORS[p.status] || ''}`}
                            >
                              {thumb && !isVideo ? (
                                <img src={thumb} alt="" loading="lazy" className="w-7 h-7 rounded object-cover shrink-0 bg-muted" />
                              ) : isVideo ? (
                                <div className="w-7 h-7 rounded shrink-0 bg-foreground/80 flex items-center justify-center">
                                  <Video className="w-3 h-3 text-background" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded shrink-0 bg-muted flex items-center justify-center">
                                  <ImageIcon className="w-3 h-3 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-0.5">
                                  {(p.platforms || []).slice(0, 3).map((pl: string) => {
                                    const Icon = PLATFORM_ICONS[pl];
                                    return Icon ? <Icon key={pl} className="w-2.5 h-2.5" /> : null;
                                  })}
                                </div>
                                <div className="truncate">{p.caption || 'Untitled'}</div>
                              </div>
                            </div>
                          );
                        })}
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
                    <div
                      key={k}
                      className="min-h-[400px] p-2 transition-colors"
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove("bg-primary/10")}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("bg-primary/10");
                        const id = e.dataTransfer.getData("text/post-id");
                        if (id) handleReschedule(id, d);
                      }}
                    >
                      <div className={`text-xs font-medium mb-2 ${isToday(d) ? "text-primary" : ""}`}>
                        {format(d, "EEE d")}
                      </div>
                      <div className="space-y-1.5">
                        {dayPosts.map(p => {
                          const thumb = p.media_url || p.image_url;
                          const isVideo = p.media_type === 'video';
                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData("text/post-id", p.id); e.dataTransfer.effectAllowed = "move"; }}
                              onClick={() => openEdit(p.id)}
                              className={`text-xs rounded cursor-grab active:cursor-grabbing overflow-hidden ${STATUS_COLORS[p.status]}`}
                            >
                              {thumb && !isVideo ? (
                                <img src={thumb} alt="" loading="lazy" className="w-full h-20 object-cover" />
                              ) : isVideo ? (
                                <div className="w-full h-20 bg-foreground/80 flex items-center justify-center">
                                  <Video className="w-5 h-5 text-background" />
                                </div>
                              ) : null}
                              <div className="p-2">
                                <div className="font-medium">{format(new Date(p.scheduled_at), 'HH:mm')}</div>
                                <div className="flex gap-1 mt-1">
                                  {(p.platforms || []).map((pl: string) => {
                                    const Icon = PLATFORM_ICONS[pl];
                                    return Icon ? <Icon key={pl} className="w-3 h-3" /> : null;
                                  })}
                                </div>
                                <div className="truncate mt-1">{p.caption}</div>
                              </div>
                            </div>
                          );
                        })}
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
              {posts.map(p => {
                const thumb = p.media_url || p.image_url;
                const isVideo = p.media_type === 'video';
                return (
                  <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-accent/30 cursor-pointer" onClick={() => openEdit(p.id)}>
                    <div className="text-xs text-muted-foreground w-32 shrink-0">{format(new Date(p.scheduled_at), 'MMM d, HH:mm')}</div>
                    {thumb && !isVideo ? (
                      <img src={thumb} alt="" loading="lazy" className="w-12 h-12 rounded object-cover shrink-0 bg-muted" />
                    ) : isVideo ? (
                      <div className="w-12 h-12 rounded shrink-0 bg-foreground/80 flex items-center justify-center">
                        <Video className="w-5 h-5 text-background" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded shrink-0 bg-muted flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex gap-1">
                      {(p.platforms || []).map((pl: string) => {
                        const Icon = PLATFORM_ICONS[pl];
                        return Icon ? <Icon key={pl} className="w-4 h-4" /> : null;
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.caption || 'Untitled'}</div>
                      {p.campaign_name && <div className="text-xs text-muted-foreground">{p.campaign_name}</div>}
                    </div>
                    <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                  </div>
                );
              })}
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
