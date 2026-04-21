import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: post, error: postErr } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block if not approved
    if (post.approval_status !== "approved") {
      return new Response(JSON.stringify({
        error: "Post is not approved. Manager approval required before firing webhooks.",
        approval_status: post.approval_status,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hooks } = await supabase
      .from("social_webhooks")
      .select("*")
      .eq("clinic_id", post.clinic_id)
      .eq("enabled", true)
      .in("platform", post.platforms);

    const results: any[] = [];
    for (const hook of hooks ?? []) {
      const firedAt = new Date().toISOString();
      try {
        const payload = {
          event: "post.publish",
          platform: hook.platform,
          scheduled_at: post.scheduled_at,
          caption: post.caption,
          hashtags: post.hashtags,
          image_url: post.image_url,
          media_url: post.media_url,
          media_type: post.media_type,
          campaign_name: post.campaign_name,
          cta_link: post.cta_link,
          target_audience: post.target_audience,
          boost_budget: post.boost_budget,
          notes: post.notes,
          post_id: post.id,
        };
        const r = await fetch(hook.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        results.push({ platform: hook.platform, ok: r.ok, status: r.status });
        await supabase.from("social_post_history").insert({
          post_id: post.id,
          clinic_id: post.clinic_id,
          platform: hook.platform,
          action: r.ok ? "webhook_fired" : "webhook_failed",
          details: { status: r.status },
        });
        // Upsert analytics row
        await supabase.from("social_post_analytics").upsert({
          post_id: post.id,
          clinic_id: post.clinic_id,
          platform: hook.platform,
          webhook_status: r.ok ? "success" : "failed",
          webhook_status_code: r.status,
          webhook_fired_at: firedAt,
        }, { onConflict: "post_id,platform" });
      } catch (e) {
        results.push({ platform: hook.platform, ok: false, error: String(e) });
        await supabase.from("social_post_history").insert({
          post_id: post.id,
          clinic_id: post.clinic_id,
          platform: hook.platform,
          action: "webhook_failed",
          details: { error: String(e) },
        });
        await supabase.from("social_post_analytics").upsert({
          post_id: post.id,
          clinic_id: post.clinic_id,
          platform: hook.platform,
          webhook_status: "error",
          webhook_status_code: 0,
          webhook_fired_at: firedAt,
        }, { onConflict: "post_id,platform" });
      }
    }

    const anyOk = results.some(r => r.ok);
    await supabase
      .from("social_posts")
      .update({
        status: anyOk ? "scheduled" : "failed",
        failure_reason: anyOk ? null : "All webhooks failed",
      })
      .eq("id", post_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
