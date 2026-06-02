import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";

export type CentroCustoTipo =
  | "administracao"
  | "mao_obra"
  | "materiais"
  | "equipamentos"
  | "terceiros"
  | "indiretos"
  | "outros";

export interface CentroCusto {
  id: string;
  company_id: string;
  parent_id: string | null;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  tipo: CentroCustoTipo;
  ordem: number;
  ativo: boolean;
}

export interface CentroCustoNode extends CentroCusto {
  children: CentroCustoNode[];
  pathLabel: string;
}

export function useCentrosCusto() {
  const { company } = useCompany();
  const [items, setItems] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!company) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("centros_custo")
      .select("*")
      .eq("company_id", company.id)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    setLoading(false);
    if (!error && data) setItems(data as CentroCusto[]);
  }, [company]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = useMemo(() => {
    const m = new Map<string, CentroCusto>();
    items.forEach((i) => m.set(i.id, i));
    return m;
  }, [items]);

  const tree = useMemo<CentroCustoNode[]>(() => {
    const map = new Map<string, CentroCustoNode>();
    items.forEach((i) => map.set(i.id, { ...i, children: [], pathLabel: i.nome }));
    const roots: CentroCustoNode[] = [];
    map.forEach((node) => {
      if (node.parent_id && map.has(node.parent_id)) {
        const parent = map.get(node.parent_id)!;
        node.pathLabel = `${parent.nome} › ${node.nome}`;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [items]);

  const flatWithPath = useMemo(() => {
    const out: CentroCustoNode[] = [];
    const walk = (nodes: CentroCustoNode[]) => {
      nodes.forEach((n) => {
        out.push(n);
        if (n.children.length) walk(n.children);
      });
    };
    walk(tree);
    return out;
  }, [tree]);

  return { items, tree, flatWithPath, byId, loading, refresh, companyId: company?.id ?? null };
}
