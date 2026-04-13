import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  clinicId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ⚠️ DEV MODE: Auth bypassed for testing. Remove this before production!
const DEV_BYPASS_AUTH = true;
const DEV_CLINIC_ID = "11158428-634b-44d3-9f40-273031345c8c";

const DEV_PROFILE: Profile = {
  id: "dev-profile-id",
  user_id: "dev-user-id",
  clinic_id: DEV_CLINIC_ID,
  full_name: "Dr. Dev",
  role: "doctor",
  specialization: null,
  avatar_url: null,
  phone: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, clinicId: null,
  loading: true, signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(DEV_BYPASS_AUTH ? DEV_PROFILE : null);
  const [loading, setLoading] = useState(DEV_BYPASS_AUTH ? false : true);

  const fetchProfile = async (userId: string) => {
    if (DEV_BYPASS_AUTH) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const refreshProfile = async () => {
    if (DEV_BYPASS_AUTH) return;
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (DEV_BYPASS_AUTH) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      session: DEV_BYPASS_AUTH ? ({} as Session) : session,
      user: DEV_BYPASS_AUTH ? ({} as User) : user,
      profile,
      clinicId: profile?.clinic_id ?? null,
      loading, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
