import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface CompanyInfo {
  id: string;
  name: string;
  role: "admin" | "member";
}

export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from("company_members")
        .select("role, company_id, companies(id, name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!memberships) {
        setCompany(null);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const co = (memberships as any).companies;
        setCompany({
          id: co.id,
          name: co.name,
          role: memberships.role as "admin" | "member",
        });
      }
    } catch (e) {
      console.error("useCompany", e);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return { company, loading: loading || authLoading, refresh };
}
