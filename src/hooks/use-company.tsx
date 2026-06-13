import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface CompanyInfo {
  id: string;
  name: string;
  role: "admin" | "editor" | "member";
}

async function fetchCompany(userId: string): Promise<CompanyInfo | null> {
  const { data: memberships, error } = await supabase
    .from("company_members")
    .select("role, company_id, companies(id, name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("useCompany", error);
    return null;
  }
  if (!memberships) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const co = (memberships as any).companies;
  return {
    id: co.id,
    name: co.name,
    role: memberships.role as "admin" | "editor" | "member",
  };
}

/**
 * Dados da empresa do usuário logado, compartilhados via TanStack Query.
 * Todos os componentes que chamam useCompany() compartilham UMA única
 * requisição em cache (antes cada instância disparava seu próprio fetch,
 * gerando 100+ requisições no carregamento inicial).
 */
export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["company", userId],
    queryFn: () => fetchCompany(userId!),
    enabled: !!userId && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    if (!userId) return;
    await qc.invalidateQueries({ queryKey: ["company", userId] });
  }, [qc, userId]);

  return {
    company: query.data ?? null,
    loading: authLoading || (!!userId && query.isPending),
    refresh,
  };
}
