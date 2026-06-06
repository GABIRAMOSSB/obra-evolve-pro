import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listObrasFinanceiro,
  getDetalheObraFinanceiro,
  type ObraFinanceira,
} from "@/lib/financeiro.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingDown, TrendingUp, FileText, HardHat, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
});

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinanceiroPage() {
  const listFn = useServerFn(listObrasFinanceiro);
  const detailFn = useServerFn(getDetalheObraFinanceiro);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: obras, isLoading } = useQuery({
    queryKey: ["financeiro", "obras"],
    queryFn: () => listFn(),
  });

  const totals = useMemo(() => {
    const arr = obras ?? [];
    return {
      contratado: arr.reduce((s, o) => s + (o.valor_contratado ?? 0), 0),
      nfe: arr.reduce((s, o) => s + o.total_nfe, 0),
      mo: arr.reduce((s, o) => s + o.total_mao_obra, 0),
      total: arr.reduce((s, o) => s + o.total_geral, 0),
    };
  }, [obras]);

  if (selected) {
    return (
      <DetailView
        obraKey={selected}
        onBack={() => setSelected(null)}
        loader={detailFn}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Financeiro de Obra</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidação de custos por obra: notas fiscais apropriadas + mão de obra apontada.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label="Contratado" value={fmt(totals.contratado)} />
        <KpiCard icon={FileText} label="NFe apropriadas" value={fmt(totals.nfe)} />
        <KpiCard icon={HardHat} label="Mão de obra" value={fmt(totals.mo)} />
        <KpiCard
          icon={totals.total <= totals.contratado ? TrendingDown : TrendingUp}
          label="Custo total"
          value={fmt(totals.total)}
          accent={totals.total > totals.contratado && totals.contratado > 0}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Obras ({obras?.length ?? 0})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (obras ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma obra com movimentação financeira encontrada.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {(obras ?? []).map((o) => (
              <ObraRow key={o.obra_id} obra={o} onClick={() => setSelected(o.obra_id)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`text-xl font-display font-bold mt-1 ${accent ? "text-destructive" : ""}`}>
            {value}
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

function ObraRow({ obra, onClick }: { obra: ObraFinanceira; onClick: () => void }) {
  const pct = obra.percentual_consumido ?? 0;
  const over = obra.valor_contratado > 0 && obra.total_geral > obra.valor_contratado;
  return (
    <button
      onClick={onClick}
      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-accent/40 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{obra.nome}</div>
          {obra.status && (
            <Badge variant="outline" className="text-[10px] uppercase">
              {obra.status}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>NFe: {fmt(obra.total_nfe)}</span>
          <span>MO: {fmt(obra.total_mao_obra)}</span>
          <span>Contratado: {fmt(obra.valor_contratado || null)}</span>
        </div>
        {obra.valor_contratado > 0 && (
          <div className="mt-2 max-w-md">
            <Progress value={Math.min(pct, 100)} className={over ? "bg-destructive/20" : ""} />
            <div className="text-[10px] text-muted-foreground mt-1">
              {pct.toFixed(1)}% consumido {over && <span className="text-destructive">• ESTOURO</span>}
            </div>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-bold font-display">{fmt(obra.total_geral)}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo total</div>
      </div>
    </button>
  );
}

function DetailView({
  obraKey,
  onBack,
  loader,
}: {
  obraKey: string;
  onBack: () => void;
  loader: ReturnType<typeof useServerFn<typeof getDetalheObraFinanceiro>>;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["financeiro", "obra", obraKey],
    queryFn: () => loader({ data: { obraKey } }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{data.obra.nome}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Detalhamento financeiro por centro de custo e movimentações recentes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Wallet} label="Contratado" value={fmt(data.obra.valor_contratado || null)} />
            <KpiCard icon={FileText} label="NFe" value={fmt(data.obra.total_nfe)} />
            <KpiCard icon={HardHat} label="Mão de obra" value={fmt(data.obra.total_mao_obra)} />
            <KpiCard
              icon={data.obra.saldo !== null && data.obra.saldo < 0 ? TrendingUp : TrendingDown}
              label="Saldo"
              value={fmt(data.obra.saldo)}
              accent={data.obra.saldo !== null && data.obra.saldo < 0}
            />
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Por centro de custo
              </h2>
            </div>
            {data.centros.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sem movimentações vinculadas a centros de custo.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {data.centros.map((c) => (
                  <div key={c.centro_custo_id ?? "sem"} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {c.codigo && (
                          <Badge variant="secondary" className="text-[10px]">{c.codigo}</Badge>
                        )}
                        <span className="font-medium truncate">{c.nome}</span>
                        {c.tipo && (
                          <Badge variant="outline" className="text-[10px] uppercase">{c.tipo}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        NFe {fmt(c.total_nfe)} • MO {fmt(c.total_mao_obra)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-bold font-display">
                      {fmt(c.total_geral)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Últimas NFe apropriadas
                </h2>
              </div>
              {data.ultimas_nfe.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma NFe.</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {data.ultimas_nfe.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.descricao}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.centro_nome ?? "Sem centro"} • {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{fmt(r.valor)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Últimos apontamentos de MO
                </h2>
              </div>
              {data.ultimos_apontamentos.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem apontamentos.</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {data.ultimos_apontamentos.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.recurso}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.centro_nome ?? "Sem centro"} • {r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—"} • {r.horas.toFixed(1)}h
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{fmt(r.custo)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
