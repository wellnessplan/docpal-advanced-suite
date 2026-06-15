import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { PostPreview } from "./PostPreview";
import { MediaUploader, type MediaKind } from "./MediaUploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, Send, Save, CheckCircle2, ShieldCheck, ShieldX, AlertCircle, Sparkles, Recycle } from "lucide-react";

const PLATFORMS = ["Facebook", "Instagram", "Twitter", "LinkedIn"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface PostEditorProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  clinicId: string;
  clinicName?: string;
  clinicLogo?: string;
  defaultDate?: Date;
  onSaved: () => void;
}

export function PostEditor({ open, onClose, postId, clinicId, clinicName, clinicLogo, defaultDate, onSaved }: PostEditorProps) {
  const { profile } = useAuth();
  const isManager = profile?.role === "admin" || profile?.role === "owner" || profile?.role === "manager";
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    platforms: [] as string[],
    scheduled_at: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    caption: "",
    hashtags: "",
    image_url: "",
    media_urls: [] as string[],
    media_kind: "image" as MediaKind,
    campaign_name: "",
    cta_link: "",
    target_audience: "",
    boost_budget: 0,
    notes: "",
    approval_status: "pending",
    rejection_reason: "",
    status: "draft",
    recycle_enabled: false,
    recycle_interval_weeks: 4,
  });
  const [previewPlatform, setPreviewPlatform] = useState("Instagram");

  // Best-time suggestions
  const { data: bestTimes } = useQuery({
    queryKey: ["best-post-times", clinicId],
    enabled: open && !!clinicId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("suggest_best_post_times", { p_clinic_id: clinicId });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const platformSuggestions = useMemo(() => {
    if (!bestTimes) return [];
    return bestTimes.filter((s: any) => form.platforms.includes(s.platform));
  }, [bestTimes, form.platforms]);

  useEffect(() => {
    if (!open) return;
    if (postId) {
      (async () => {
        const { data } = await supabase.from("social_posts").select("*").eq("id", postId).single();
        if (data) {
          const d = data as any;
          const urls: string[] = d.media_urls?.length ? d.media_urls
            : d.media_url ? [d.media_url]
            : d.image_url ? [d.image_url]
            : [];
          setForm({
            platforms: d.platforms || [],
            scheduled_at: format(new Date(d.scheduled_at), "yyyy-MM-dd'T'HH:mm"),
            caption: d.caption || "",
            hashtags: d.hashtags || "",
            image_url: d.image_url || "",
            media_urls: urls,
            media_kind: (d.media_kind || (urls.length > 1 ? "carousel" : d.media_type === "video" ? "video" : "image")) as MediaKind,
            campaign_name: d.campaign_name || "",
            cta_link: d.cta_link || "",
            target_audience: d.target_audience || "",
            boost_budget: d.boost_budget || 0,
            notes: d.notes || "",
            approval_status: d.approval_status || "pending",
            rejection_reason: d.rejection_reason || "",
            status: d.status || "draft",
            recycle_enabled: !!d.recycle_enabled,
            recycle_interval_weeks: d.recycle_interval_weeks || 4,
          });
          if (d.platforms?.[0]) setPreviewPlatform(d.platforms[0]);
        }
      })();
    } else {
      setForm({
        platforms: [],
        scheduled_at: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        caption: "", hashtags: "", image_url: "", media_urls: [], media_kind: "image",
        campaign_name: "", cta_link: "", target_audience: "", boost_budget: 0,
        notes: "", approval_status: "pending", rejection_reason: "", status: "draft",
        recycle_enabled: false, recycle_interval_weeks: 4,
      });
    }
  }, [open, postId, defaultDate]);

  const togglePlatform = (p: string) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
    if (!form.platforms.includes(p)) setPreviewPlatform(p);
  };

  const applySuggestion = (s: any) => {
    // Find the next occurrence of weekday s.weekday at hour s.hour
    const now = new Date();
    const result = new Date(now);
    result.setHours(s.hour, 0, 0, 0);
    const targetDow = s.weekday;
    const diff = (targetDow - result.getDay() + 7) % 7 || (result <= now ? 7 : 0);
    result.setDate(result.getDate() + diff);
    setForm(f => ({ ...f, scheduled_at: format(result, "yyyy-MM-dd'T'HH:mm") }));
    toast.success(`Set to ${DOW[s.weekday]} ${String(s.hour).padStart(2, "0")}:00`);
  };

  const handleSave = async (publish = false) => {
    if (!form.platforms.length) { toast.error("Select at least one platform"); return; }
    if (!form.caption.trim()) { toast.error("Caption is required"); return; }
    if (publish && form.approval_status !== "approved") {
      toast.error("Post must be approved by a manager before scheduling");
      return;
    }
    setLoading(true);
    try {
      const cover = form.media_urls[0] || form.image_url || null;
      const isVid = cover ? /\.(mp4|mov|webm|m4v)(\?|$)/i.test(cover) : false;
      const payload: any = {
        clinic_id: clinicId,
        platforms: form.platforms,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        caption: form.caption,
        hashtags: form.hashtags,
        image_url: form.image_url || null,
        media_urls: form.media_urls,
        media_url: cover,
        media_type: isVid ? "video" : "image",
        media_kind: form.media_kind,
        campaign_name: form.campaign_name || null,
        cta_link: form.cta_link || null,
        target_audience: form.target_audience || null,
        boost_budget: Number(form.boost_budget) || 0,
        notes: form.notes || null,
        approval_status: form.approval_status,
        rejection_reason: form.approval_status === "rejected" ? form.rejection_reason : null,
        status: publish ? "scheduled" : form.status,
        recycle_enabled: form.recycle_enabled,
        recycle_interval_weeks: Math.max(1, Number(form.recycle_interval_weeks) || 4),
      };
      let savedId = postId;
      if (postId) {
        const { error } = await supabase.from("social_posts").update(payload).eq("id", postId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("social_posts").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
      }

      if (publish && savedId) {
        const { error: fnErr } = await supabase.functions.invoke("social-post-webhook", {
          body: { post_id: savedId },
        });
        if (fnErr) toast.warning("Saved but webhook fire failed: " + fnErr.message);
        else toast.success("Saved & webhook fired!");
      } else {
        toast.success("Post saved");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!postId) return;
    if (!isManager) { toast.error("Only managers can approve"); return; }
    setLoading(true);
    const { error } = await supabase.from("social_posts").update({
      approval_status: "approved", approved_by: profile?.user_id,
      approved_at: new Date().toISOString(), rejection_reason: null,
    }).eq("id", postId);
    if (error) toast.error(error.message);
    else { toast.success("Post approved"); setForm(f => ({ ...f, approval_status: "approved" })); onSaved(); }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!postId) return;
    if (!isManager) { toast.error("Only managers can reject"); return; }
    const reason = prompt("Reason for rejection?", form.rejection_reason || "");
    if (reason === null) return;
    setLoading(true);
    const { error } = await supabase.from("social_posts").update({
      approval_status: "rejected", rejection_reason: reason,
      approved_by: profile?.user_id, approved_at: new Date().toISOString(),
    }).eq("id", postId);
    if (error) toast.error(error.message);
    else { toast.success("Post rejected"); setForm(f => ({ ...f, approval_status: "rejected", rejection_reason: reason })); onSaved(); }
    setLoading(false);
  };

  const handleMarkPosted = async () => {
    if (!postId) return;
    setLoading(true);
    const { error } = await supabase.from("social_posts").update({
      status: "posted", posted_at: new Date().toISOString(),
    }).eq("id", postId);
    if (error) toast.error(error.message);
    else { toast.success("Marked as posted"); onSaved(); onClose(); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!postId || !confirm("Delete this post?")) return;
    const { error } = await supabase.from("social_posts").delete().eq("id", postId);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onSaved(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{postId ? "Edit Post" : "New Post"}</DialogTitle>
        </DialogHeader>

        <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
          form.approval_status === "approved" ? "bg-green-500/10 text-green-700 dark:text-green-300" :
          form.approval_status === "rejected" ? "bg-destructive/10 text-destructive" :
          "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}>
          {form.approval_status === "approved" ? <ShieldCheck className="w-4 h-4" /> :
           form.approval_status === "rejected" ? <ShieldX className="w-4 h-4" /> :
           <AlertCircle className="w-4 h-4" />}
          <div className="flex-1">
            <span className="font-medium capitalize">{form.approval_status}</span>
            {form.approval_status === "rejected" && form.rejection_reason && (
              <span className="ml-2 text-xs">— {form.rejection_reason}</span>
            )}
            {form.approval_status === "pending" && (
              <span className="ml-2 text-xs">Manager approval required before scheduling.</span>
            )}
          </div>
          {postId && isManager && form.approval_status !== "approved" && (
            <Button size="sm" variant="outline" onClick={handleApprove} disabled={loading}>
              <ShieldCheck className="w-4 h-4 mr-1" /> Approve
            </Button>
          )}
          {postId && isManager && form.approval_status !== "rejected" && (
            <Button size="sm" variant="outline" onClick={handleReject} disabled={loading}>
              <ShieldX className="w-4 h-4 mr-1" /> Reject
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border cursor-pointer text-sm">
                    <Checkbox checked={form.platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Scheduled at</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {platformSuggestions.length > 0 && (
              <div className="rounded-md border bg-primary/5 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Best times from your analytics
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {platformSuggestions.map((s: any, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="text-[11px] px-2 py-1 rounded-full bg-background border hover:bg-primary hover:text-primary-foreground transition"
                      title={`${s.samples} samples · score ${s.score}${s.engagement_rate_pct ? ` · ${s.engagement_rate_pct}%` : ""}`}
                    >
                      <span className="font-semibold">{s.platform}</span> · {DOW[s.weekday]} {String(s.hour).padStart(2, "0")}:00
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Caption</Label>
              <Textarea rows={4} value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="What's the message?" />
              <div className="text-xs text-muted-foreground mt-1">{form.caption.length} chars</div>
            </div>

            <div>
              <Label>Hashtags</Label>
              <Input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#dentist #smile #clinic" />
            </div>

            <div>
              <Label>Media</Label>
              <MediaUploader
                clinicId={clinicId}
                mediaUrls={form.media_urls}
                mediaKind={form.media_kind}
                onChange={(urls, kind) => setForm(f => ({ ...f, media_urls: urls, media_kind: kind }))}
              />
            </div>

            <div>
              <Label>Or paste image URL (single)</Label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Campaign</Label>
                <Input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} placeholder="Diwali offer" />
              </div>
              <div>
                <Label>CTA link</Label>
                <Input value={form.cta_link} onChange={e => setForm(f => ({ ...f, cta_link: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target audience</Label>
                <Input value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} placeholder="Adults 25-45, local" />
              </div>
              <div>
                <Label>Boost budget</Label>
                <Input type="number" value={form.boost_budget} onChange={e => setForm(f => ({ ...f, boost_budget: Number(e.target.value) }))} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Recycle evergreen */}
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label className="flex items-center gap-1.5"><Recycle className="w-3.5 h-3.5" /> Recycle as evergreen</Label>
                  <p className="text-[11px] text-muted-foreground">Auto-clone & repost this top performer on a schedule. Runs weekly cron.</p>
                </div>
                <Switch checked={form.recycle_enabled} onCheckedChange={v => setForm(f => ({ ...f, recycle_enabled: v }))} />
              </div>
              {form.recycle_enabled && (
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Repeat every (weeks)</Label>
                    <Input type="number" min={1} max={52} value={form.recycle_interval_weeks}
                      onChange={e => setForm(f => ({ ...f, recycle_interval_weeks: Number(e.target.value) }))} />
                  </div>
                  <p className="text-[11px] text-muted-foreground pb-2">Cloned posts schedule 3 days out and auto-fire the webhook.</p>
                </div>
              )}
            </div>

            <div>
              <Label>Approval</Label>
              <Select value={form.approval_status} onValueChange={v => setForm(f => ({ ...f, approval_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Preview</Label>
            <Tabs value={previewPlatform} onValueChange={setPreviewPlatform}>
              <TabsList className="grid grid-cols-4 w-full">
                {PLATFORMS.map(p => <TabsTrigger key={p} value={p}>{p}</TabsTrigger>)}
              </TabsList>
              {PLATFORMS.map(p => (
                <TabsContent key={p} value={p} className="mt-4">
                  <PostPreview
                    platform={p}
                    caption={form.caption}
                    hashtags={form.hashtags}
                    image_url={form.media_urls[0] || form.image_url}
                    cta_link={form.cta_link}
                    clinic_name={clinicName}
                    clinic_logo={clinicLogo}
                  />
                  {form.media_urls.length > 1 && (
                    <div className="mt-2 flex gap-1 overflow-x-auto">
                      {form.media_urls.map((u, i) => (
                        <img key={u} src={u} alt={`slide ${i + 1}`} className="w-12 h-12 rounded object-cover border" />
                      ))}
                      <Badge variant="secondary" className="self-center text-[10px]">{form.media_urls.length} slides</Badge>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-between border-t border-border pt-4">
          <div className="flex gap-2">
            {postId && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
            {postId && form.status !== "posted" && (
              <Button variant="outline" size="sm" onClick={handleMarkPosted}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Mark as posted
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={loading}>
              <Save className="w-4 h-4 mr-1" /> Save Draft
            </Button>
            <Button onClick={() => handleSave(true)} disabled={loading}>
              <Send className="w-4 h-4 mr-1" /> Schedule & Fire Webhook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
