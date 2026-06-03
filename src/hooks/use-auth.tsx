import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dedupe: ignore auth events that don't actually change the user identity
    // or access token. Without this, TOKEN_REFRESHED (fired when the tab regains
    // focus) creates a new session reference, which cascades into full-screen
    // re-loads downstream (useCompany, workspace fetch, etc).
    const applySession = (next: Session | null) => {
      setSession((prev) => {
        if (prev === next) return prev;
        if (
          prev &&
          next &&
          prev.user.id === next.user.id &&
          prev.access_token === next.access_token
        ) {
          return prev;
        }
        return next;
      });
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      applySession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });
    return () => subscription.unsubscribe();
  }, []);


  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
