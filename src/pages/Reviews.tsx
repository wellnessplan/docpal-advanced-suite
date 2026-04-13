import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Reviews() {
  const { clinicId } = useAuth();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, patients(full_name)")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicId,
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "N/A";

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold">Reviews & Feedback</h1>
            <p className="text-muted-foreground text-sm">Average rating: {avgRating} ⭐ · {reviews.length} reviews</p>
          </div>
          <Button size="sm" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Request Review</Button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[5, 4, 3, 2].map(star => (
            <Card key={star}>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {Array.from({ length: star }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg font-bold">{reviews.filter((r: any) => r.rating === star).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-lg">No reviews yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Send review requests to patients after treatment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reviews.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{r.patients?.full_name || "Anonymous"}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                  {r.feedback && <p className="text-sm text-muted-foreground">{r.feedback}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
