import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface CompanyInfo {
  id: string;
  name: string;
  role: "admin" | "editor" | "member";
}

export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCompany(null);
      setLoading(false);
      hasLoadedRef.current = true;
      return;
    }
    // Only flip to "loading" on the very first fetch — subsequent refreshes
    // (e.g. triggered by tab focus / token refresh) happen in background so
    // the UI doesn't blank out.
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from("company_members")
        .select("role, company_id, companies(id, name)")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!memberships) {
        setCompany(null);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const co = (memberships as any).companies;
        const next: CompanyInfo = {
          id: co.id,
          name: co.name,
          role: memberships.role as "admin" | "editor" | "member",
        };
        setCompany((prev) =>
          prev && prev.id === next.id && prev.name === next.name && prev.role === next.role
            ? prev
            : next,
        );
      }
    } catch (e) {
      console.error("useCompany", e);
      setCompany(null);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return { company, loading: loading || authLoading, refresh };
}

