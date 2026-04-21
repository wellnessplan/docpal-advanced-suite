import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PostPreview } from "./PostPreview";
import { MediaUploader } from "./MediaUploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, Send, Save, CheckCircle2, ShieldCheck, ShieldX, AlertCircle } from "lucide-react";

const PLATFORMS = ["Facebook", "Instagram", "Twitter", "LinkedIn"];

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
    media_url: "",
    media_type: "",
    campaign_name: "",
    cta_link: "",
    target_audience: "",
    boost_budget: 0,
    notes: "",
    approval_status: "pending",
    rejection_reason: "",
    status: "draft",
  });
  const [previewPlatform, setPreviewPlatform] = useState("Instagram");

  useEffect(() => {
    if (!open) return;
    if (postId) {
      (async () => {
        const { data } = await supabase.from("social_posts").select("*").eq("id", postId).single();
        if (data) {
          setForm({
            platforms: data.platforms || [],
            scheduled_at: format(new Date(data.scheduled_at), "yyyy-MM-dd'T'HH:mm"),
            caption: data.caption || "",
            hashtags: data.hashtags || "",
            image_url: data.image_url || "",
            media_url: (data as any).media_url || "",
            media_type: (data as any).media_type || "",
            campaign_name: data.campaign_name || "",
            cta_link: data.cta_link || "",
            target_audience: data.target_audience || "",
            boost_budget: data.boost_budget || 0,
            notes: data.notes || "",
            approval_status: data.approval_status || "pending",
            rejection_reason: (data as any).rejection_reason || "",
            status: data.status || "draft",
          });
          if (data.platforms?.[0]) setPreviewPlatform(data.platforms[0]);
        }
      })();
    } else {
      setForm({
        platforms: [],
        scheduled_at: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        caption: "", hashtags: "", image_url: "", media_url: "", media_type: "",
        campaign_name: "", cta_link: "", target_audience: "", boost_budget: 0,
        notes: "", approval_status: "pending", rejection_reason: "", status: "draft",
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

  const handleSave = async (publish = false) => {
    if (!form.platforms.length) { toast.error("Select at least one platform"); return; }
    if (!form.caption.trim()) { toast.error("Caption is required"); return; }
    if (publish && form.approval_status !== "approved") {
      toast.error("Post must be approved by a manager before scheduling");
      return;
    }
    setLoading(true);
    try {
      const { rejection_reason, ...rest } = form;
      const payload: any = {
        ...rest,
        clinic_id: clinicId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        boost_budget: Number(form.boost_budget) || 0,
        status: publish ? "scheduled" : form.status,
        rejection_reason: form.approval_status === "rejected" ? rejection_reason : null,
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
      approval_status: "approved",
      approved_by: profile?.user_id,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
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
      approval_status: "rejected",
      rejection_reason: reason,
      approved_by: profile?.user_id,
      approved_at: new Date().toISOString(),
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

        {/* Approval banner */}
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
          {/* Form side */}
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
              <Label>Media (image or video)</Label>
              <MediaUploader
                clinicId={clinicId}
                mediaUrl={form.media_url}
                mediaType={form.media_type}
                onChange={(url, type) => setForm(f => ({ ...f, media_url: url || "", media_type: type || "" }))}
              />
            </div>

            <div>
              <Label>Or paste image URL</Label>
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

          {/* Preview side */}
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
                    image_url={form.image_url}
                    cta_link={form.cta_link}
                    clinic_name={clinicName}
                    clinic_logo={clinicLogo}
                  />
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
