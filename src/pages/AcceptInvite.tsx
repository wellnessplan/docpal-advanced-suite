import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, CheckCircle2, Loader2 } from "lucide-react";

interface Invite {
  id: string;
  clinic_id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  expires_at: string | null;
  clinic_name?: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signup form state
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError("Missing invite token."); setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from("staff_invitations")
        .select("id, clinic_id, email, full_name, role, status, expires_at")
        .eq("invite_token", token)
        .maybeSingle();

      if (error || !data) { setError("Invitation not found or invalid."); setLoading(false); return; }
      if (data.status !== "pending") { setError("This invitation has already been used."); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setError("This invitation has expired."); setLoading(false); return; }

      // Fetch clinic name
      const { data: clinic } = await supabase.from("clinics").select("name").eq("id", data.clinic_id).maybeSingle();
      setInvite({ ...data, clinic_name: clinic?.name });
      setFullName(data.full_name || "");
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !token) return;
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setSubmitting(true);

    try {
      // Sign out any current session (e.g. demo) so we can sign up the new staff member
      await supabase.auth.signOut();

      // Sign up the new user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite/${token}`,
          data: { full_name: fullName || invite.full_name || invite.email.split("@")[0] },
        },
      });

      if (signUpError) {
        // If user already exists, try signing in instead
        if (signUpError.message.toLowerCase().includes("already")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });
          if (signInError) throw new Error("Account exists with a different password. Please contact your clinic admin.");
        } else {
          throw signUpError;
        }
      }

      // Wait briefly for profile creation trigger
      await new Promise((r) => setTimeout(r, 800));

      // Accept the invitation (server-side RPC links profile to clinic + role)
      const { error: rpcError } = await (supabase as any).rpc("accept_staff_invitation", { p_token: token });
      if (rpcError) throw rpcError;

      setDone(true);
      toast.success("Welcome to the team!");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (e: any) {
      toast.error(e.message || "Failed to accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Invalid</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth"><Button variant="outline" className="w-full">Go to Sign In</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Welcome aboard!</h2>
            <p className="text-muted-foreground">You're now part of {invite?.clinic_name}. Redirecting to dashboard…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center">Join {invite?.clinic_name || "the clinic"}</CardTitle>
          <CardDescription className="text-center">
            You've been invited as a <strong>{invite?.role}</strong>. Set up your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={invite?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Create Password *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={6} placeholder="At least 6 characters" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up…</> : "Accept Invite & Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
