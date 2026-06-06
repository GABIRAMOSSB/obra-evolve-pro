import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCcw, TrendingUp, Plus, Trash2, Download } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  CATALOGO_INDICES,
  listIndicesEconomicos,
  sincronizarIndiceBCB,
  upsertIndiceManual,
  excluirIndice,
} from "@/lib/indices.functions";

export const Route = createFileRoute("/_app/indices")({
  component: IndicesPage,
});

const pct = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toFixed(4)}%`;

const fmtMes = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
};

function IndicesPage() {
  const listFn = useServerFn(listIndicesEconomicos);
  const syncFn = useServerFn(sincronizarIndiceBCB);
  const upsertFn = useServerFn(upsertIndiceManual);
  const delFn = useServerFn(excluirIndice);
  const qc = useQueryClient();

  const [filtroIndice, setFiltroIndice] = useState<string>("");
  const [syncIndice, setSyncIndice] = useState<string>("IPCA");
  const [manualOpen, setManualOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["indices", filtroIndice],
    queryFn: () => listFn({ data: filtroIndice ? { indice: filtroIndice } : {} }),
  });

  const syncMut = useMutation({
    mutationFn: async (indice: string) => syncFn({ data: { indice } }),
    onSuccess: (res) => {
      toast.success(`${res.indice}: ${res.gravados} registro(s) sincronizado(s).`);
      qc.invalidateQueries({ queryKey: ["indices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncAllMut = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const c of CATALOGO_INDICES) {
        try {
          const r = await syncFn({ data: { indice: c.codigo } });
          results.push({ ok: true, ...r });
        } catch (e) {
          results.push({ ok: false, indice: c.codigo, error: (e as Error).message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.ok).length;
      toast.success(`Sincronização completa: ${ok}/${results.length} índices.`);
      qc.invalidateQueries({ queryKey: ["indices"] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["indices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumo = data?.resumo ?? [];
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Índices Econômicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            IPCA, INPC, IGP-M, IGP-DI, INCC, SELIC e CDI — sincronização automática via BCB SGS (sem credencial).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncAllMut.mutate()}
            disabled={syncAllMut.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {syncAllMut.isPending ? "Sincronizando…" : "Sincronizar todos"}
          </Button>
          <ManualEntryDialog
            open={manualOpen}
            onOpenChange={setManualOpen}
            onSubmit={async (payload) => {
              try {
                await upsertFn({ data: payload });
                toast.success("Índice registrado manualmente.");
                qc.invalidateQueries({ queryKey: ["indices"] });
                setManualOpen(false);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        </div>
      </div>

      {/* KPIs por índice */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {CATALOGO_INDICES.map((cat) => {
          const r = resumo.find((x) => x.indice === cat.codigo);
          return (
            <Card key={cat.codigo} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cat.nome}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">SGS {cat.sgs}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Último mês</div>
                  <div className="text-sm font-medium">{fmtMes(r?.ultimo_mes)}</div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Var. mês</span>
                  <span className="font-mono">{r ? pct(r.ultimo_valor) : "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Acum. 12m</span>
                  <span className="font-mono font-semibold">
                    {r ? pct(r.acumulado_12m_pct) : "—"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => syncMut.mutate(cat.codigo)}
                  disabled={syncMut.isPending}
                >
                  <RefreshCcw className="w-3 h-3 mr-1" />
                  Sincronizar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Série histórica</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filtroIndice || "all"} onValueChange={(v) => setFiltroIndice(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todos os índices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os índices</SelectItem>
                  {CATALOGO_INDICES.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum registro. Use “Sincronizar todos” para importar das fontes oficiais.
            </div>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="text-left p-2">Índice</th>
                    <th className="text-left p-2">Mês ref.</th>
                    <th className="text-right p-2">Var. %</th>
                    <th className="text-left p-2">Fonte</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(rows as Array<{ id: string; indice: string; mes_referencia: string; valor_percentual: number | string; fonte: string | null }>).map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-medium">{r.indice}</td>
                      <td className="p-2">{fmtMes(r.mes_referencia as string)}</td>
                      <td className="p-2 text-right font-mono">{pct(r.valor_percentual)}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r.fonte ?? "—"}</td>
                      <td className="p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            if (confirm("Remover este registro?")) delMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManualEntryDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (p: { indice: string; mes_referencia: string; valor_percentual: number; fonte?: string }) => void;
}) {
  const [indice, setIndice] = useState("IPCA");
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [valor, setValor] = useState("");
  const [fonte, setFonte] = useState("manual");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Lançar manualmente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar índice (manual)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Índice</Label>
            <Input
              value={indice}
              onChange={(e) => setIndice(e.target.value.toUpperCase())}
              placeholder="IPCA, INCC, IGP-M…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mês referência</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
            <div>
              <Label>Variação % no mês</Label>
              <Input
                type="number"
                step="0.0001"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.4500"
              />
            </div>
          </div>
          <div>
            <Label>Fonte</Label>
            <Input value={fonte} onChange={(e) => setFonte(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const v = Number(valor);
              if (!indice || !mes || Number.isNaN(v)) {
                toast.error("Preencha índice, mês e valor.");
                return;
              }
              onSubmit({
                indice,
                mes_referencia: `${mes}-01`,
                valor_percentual: v,
                fonte: fonte || undefined,
              });
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
