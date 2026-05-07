import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: (Profile & { group_id?: string | null }) | null;
  clinicId: string | null;
  groupId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEV_BYPASS_AUTH = false;
const DEMO_MODE = true;
const DEMO_EMAIL = "demo@doctorsbuddy.app";
const DEMO_PASSWORD = "DemoPass2026!";

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, clinicId: null, groupId: null,
  loading: true, signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    if (DEV_BYPASS_AUTH) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) {
        console.error("fetchProfile error:", error.message);
      }
      setProfile(data);
    } catch (err) {
      console.error("fetchProfile exception:", err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (DEV_BYPASS_AUTH) return;
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    let mounted = true;

    // Safety timeout: never stay loading for more than 5 seconds
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session && DEMO_MODE) {
        // Auto-login with shared demo account
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
        if (mounted && signInData.session) {
          setSession(signInData.session);
          setUser(signInData.session.user);
          await fetchProfile(signInData.session.user.id);
        }
        if (mounted) setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      console.error("getSession error:", err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (DEV_BYPASS_AUTH) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    if (DEMO_MODE) {
      const { data } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await fetchProfile(data.session.user.id);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      clinicId: profile?.clinic_id ?? null,
      loading, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
