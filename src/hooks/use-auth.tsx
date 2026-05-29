import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { display_name: string; avatar_initials: string | null } | null;
  accountId: string | null;
  organizationId: string | null;
  organizationRole: "owner" | "org_admin" | "member" | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthCtx["profile"]>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<AuthCtx["organizationRole"]>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setAccountId(null);
        setOrganizationRole(null);
        setIsAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    const [{ data: prof }, { data: roles }, { data: memberships }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_initials, account_id").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      (supabase as any)
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", uid)
        .eq("is_active", true)
        .limit(1),
    ]);
    const membership = ((memberships ?? []) as any[])[0] ?? null;
    const currentAccountId = (prof as any)?.account_id ?? membership?.account_id ?? null;
    setProfile(prof ? { display_name: prof.display_name, avatar_initials: (prof as any).avatar_initials } : null);
    setAccountId(currentAccountId);
    setOrganizationRole((membership?.role ?? null) as AuthCtx["organizationRole"]);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
  }

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signUp: AuthCtx["signUp"] = async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/conversas`,
        data: { display_name: displayName },
      },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        profile,
        accountId,
        organizationId: accountId,
        organizationRole,
        isAdmin,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
