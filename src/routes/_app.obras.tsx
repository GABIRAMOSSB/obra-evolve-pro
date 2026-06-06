import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listObras, syncObrasFromWorkspace } from "@/lib/obras.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/obras")({
  component: ObrasPage,
  head: () => ({
    meta: [{ title: "Obras — SOLV Gestão" }],
  }),
});

function fmtCurrency(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ObrasPage() {
  const listFn = useServerFn(listObras);
  const syncFn = useServerFn(syncObrasFromWorkspace);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["obras-normalized"],
    queryFn: () => listFn(),
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => {
      toast.success(
        `Sincronização: ${r.inserted} novas, ${r.updated} atualizadas, ${r.contratos_inserted + r.contratos_updated} contratos.` +
          (r.errors.length ? ` (${r.errors.length} erros)` : ""),
      );
      qc.invalidateQueries({ queryKey: ["obras-normalized"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const obras = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Obras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tabela normalizada espelhada do workspace legado. O BM atual continua usando o blob JSONB.
          </p>
        </div>
        <Button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="gap-2"
        >
          {sync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar do workspace
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Carregando…</div>
        ) : obras.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            Nenhuma obra normalizada. Use <strong>Sincronizar</strong> para importar do workspace.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Obra</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Local</th>
                  <th className="px-4 py-3 text-left">Início</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Contratos</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {obras.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.nome}</div>
                      {o.codigo && <div className="text-xs text-muted-foreground">{o.codigo}</div>}
                    </td>
                    <td className="px-4 py-3">{o.cliente ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[o.cidade, o.uf].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.data_inicio ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(o.valor_contratado)}</td>
                    <td className="px-4 py-3 text-center">{o.contratos_count}</td>
                    <td className="px-4 py-3">
                      <Badge variant={o.status === "ativa" ? "default" : "secondary"}>{o.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {o.origem === "workspace_sync" ? "sync" : o.origem}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
