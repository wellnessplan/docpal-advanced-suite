import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Percent, IndianRupee, Copy } from "lucide-react";

interface Props {
  clinicId: string;
}

export default function DiscountCouponsTab({ clinicId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
  });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["discount-coupons", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discount_coupons").insert({
        clinic_id: clinicId,
        code: form.code.toUpperCase().trim(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon created");
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
      setOpen(false);
      setForm({ code: "", description: "", discount_type: "percent", discount_value: "", valid_from: "", valid_until: "", max_uses: "" });
    },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "This coupon code already exists" : e.message),
  });

  const toggleCoupon = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("discount_coupons").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["discount-coupons"] }),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon deleted");
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Discount Coupons
            </CardTitle>
            <CardDescription>Create coupon codes that can be applied during billing</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Discount Coupon</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Coupon Code *</Label>
                  <Input
                    placeholder="e.g. WELCOME10"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="uppercase"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g. 10% off for new patients"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Discount Type</Label>
                    <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (Rs )</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value *</Label>
                    <Input
                      type="number"
                      placeholder={form.discount_type === "percent" ? "e.g. 10" : "e.g. 500"}
                      value={form.discount_value}
                      onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valid From</Label>
                    <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Valid Until</Label>
                    <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Max Uses (leave empty for unlimited)</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={form.max_uses}
                    onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createCoupon.mutate()}
                  disabled={!form.code || !form.discount_value || createCoupon.isPending}
                >
                  Create Coupon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No coupons yet. Create one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{c.code}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 font-medium">
                        {c.discount_type === "percent" ? (
                          <><Percent className="h-3 w-3" />{c.discount_value}%</>
                        ) : (
                          <><IndianRupee className="h-3 w-3" />Rs {c.discount_value}</>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.valid_from || c.valid_until ? (
                        <>{c.valid_from || "—"} → {c.valid_until || "—"}</>
                      ) : "No limit"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={checked => toggleCoupon.mutate({ id: c.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteCoupon.mutate(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
