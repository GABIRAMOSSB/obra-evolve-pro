import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Calculator } from "lucide-react";
import {
  computeMetaCalc,
  fmtBRL,
  fmtNum,
  metaStatus,
  type MetaParams,
} from "@/lib/calc";
import type { BudgetRow, ProjectData, Workspace } from "@/lib/types";

export const Route = createFileRoute("/_app/comparativo-composicao")({
  component: ComparativoPage,
  head: () => ({
    meta: [{ title: "Comparativo por Composição" }],
  }),
});

type Apropriacao = {
  obra_id: string | null;
  item_codigo: string;
  valor_total: number;
};

type Apontamento = {
  obra_id: string;
  item_codigo: string | null;
  recurso_tipo: "mao_obra" | "equipamento" | string;
  custo_total: number;
};

const DEFAULT_PARAMS: MetaParams = {
  iss: 5,
  pis: 0.65,
  cofins: 3,
  irpj: 4.8,
  csll: 2.88,
  lucro: 25,
};

function ComparativoPage() {
  const { company } = useCompany();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [obraId, setObraId] = useState<string>("");
  const [apropriacoes, setApropriacoes] = useState<Apropriacao[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [params, setParams] = useState<MetaParams>(DEFAULT_PARAMS);
  const [memoria, setMemoria] = useState<BudgetRow | null>(null);

  // workspace
  useEffect(() => {
    if (!company) return;
    supabase
      .from("company_workspaces")
      .select("workspace")
      .eq("company_id", company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.workspace) {
          const w = data.workspace as unknown as Workspace;
          setWs(w);
          if (w.activeId) setObraId(w.activeId);
          else if (w.obras[0]) setObraId(w.obras[0].id);
        }
      });
  }, [company]);

  // parâmetros financeiros
  useEffect(() => {
    if (!company) return;
    supabase
      .from("parametros_financeiros")
      .select(
        "iss_percent, pis_percent, cofins_percent, irpj_percent, csll_percent, lucro_pretendido_percent",
      )
      .eq("company_id", company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setParams({
          iss: Number(data.iss_percent),
          pis: Number(data.pis_percent),
          cofins: Number(data.cofins_percent),
          irpj: Number(data.irpj_percent),
          csll: Number(data.csll_percent),
          lucro: Number(data.lucro_pretendido_percent),
        });
      });
  }, [company]);

  // realizado: apropriações de NF + apontamentos
  useEffect(() => {
    if (!company) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("nfe_item_apropriacoes")
      .select("obra_id, item_codigo, valor_total")
      .eq("company_id", company.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setApropriacoes((data as Apropriacao[]) ?? []));
    supabase
      .from("apontamentos_mao_obra")
      .select("obra_id, item_codigo, recurso_tipo, custo_total")
      .eq("company_id", company.id)
      .then(({ data }) => setApontamentos((data as Apontamento[]) ?? []));
  }, [company]);

  const obras = ws?.obras ?? [];
  const obra: ProjectData | undefined = useMemo(
    () => obras.find((o) => o.id === obraId),
    [obras, obraId],
  );

  const isSintetico = obra?.modelo === "modelo_orcamento_sintetico";

  const linhas = useMemo(() => {
    if (!obra || !isSintetico) return [];
    const composicoes = obra.rows.filter((r) => r.tipoLinha === "composicao");

    // realizado por item_codigo
    const matRealByCodigo = new Map<string, number>();
    for (const a of apropriacoes) {
      if (a.obra_id !== obra.id) continue;
      const k = a.item_codigo || "";
      matRealByCodigo.set(k, (matRealByCodigo.get(k) ?? 0) + Number(a.valor_total || 0));
    }
    const moRealByCodigo = new Map<string, number>();
    const eqRealByCodigo = new Map<string, number>();
    for (const ap of apontamentos) {
      if (ap.obra_id !== obra.id) continue;
      const k = ap.item_codigo || "";
      const v = Number(ap.custo_total || 0);
      if (ap.recurso_tipo === "equipamento") {
        eqRealByCodigo.set(k, (eqRealByCodigo.get(k) ?? 0) + v);
      } else {
        moRealByCodigo.set(k, (moRealByCodigo.get(k) ?? 0) + v);
      }
    }

    return composicoes.map((r) => {
      const calc = computeMetaCalc(r, params);
      const moReal = moRealByCodigo.get(r.codigo) ?? 0;
      const matReal = matRealByCodigo.get(r.codigo) ?? 0;
      const eqReal = eqRealByCodigo.get(r.codigo) ?? 0;
      const realizadoTotal = moReal + matReal + eqReal;
      const saldoMeta = calc.custoMeta - realizadoTotal;
      const lucroAtual = calc.precoVendaTotal - calc.impostosNota - realizadoTotal;
      const margemAtual =
        calc.precoVendaTotal > 0 ? (lucroAtual / calc.precoVendaTotal) * 100 : 0;
      const status = metaStatus(saldoMeta, calc.custoMeta);
      return {
        row: r,
        calc,
        moPrevisto: r.totalMO ?? 0,
        matPrevisto: r.totalMaterial ?? 0,
        previstoTotal: (r.totalMO ?? 0) + (r.totalMaterial ?? 0),
        moReal,
        matReal,
        eqReal,
        realizadoTotal,
        saldoMeta,
        lucroAtual,
        margemAtual,
        status,
      };
    });
  }, [obra, isSintetico, apropriacoes, apontamentos, params]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Comparativo por Composição</h1>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">Obra:</div>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecione a obra" />
          </SelectTrigger>
          <SelectContent>
            {obras.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}{" "}
                {o.modelo === "modelo_orcamento_sintetico" ? "• Sintético" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {obra && (
          <Badge variant="outline" className="text-[10px]">
            {obra.modelo === "modelo_orcamento_sintetico"
              ? "Modelo: Orçamento Sintético"
              : "Modelo: Padrão"}
          </Badge>
        )}
      </Card>

      {!obra ? (
        <Card className="p-6 text-sm text-muted-foreground">Selecione uma obra.</Card>
      ) : !isSintetico ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Esta tela está disponível apenas para obras importadas no modelo{" "}
          <strong>Orçamento Sintético</strong>. Reimporte a planilha contendo a aba{" "}
          <em>Orçamento Sintético</em> para utilizar o comparativo por composição.
        </Card>
      ) : (
        <Card className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Código</th>
                <th className="px-2 py-2">Banco</th>
                <th className="px-2 py-2 min-w-[280px]">Descrição</th>
                <th className="px-2 py-2">Und</th>
                <th className="px-2 py-2 text-right">Qtd</th>
                <th className="px-2 py-2 text-right">Preço Venda</th>
                <th className="px-2 py-2 text-right">Impostos</th>
                <th className="px-2 py-2 text-right">Lucro Plan.</th>
                <th className="px-2 py-2 text-right">Custo Meta</th>
                <th className="px-2 py-2 text-right">MO Prev.</th>
                <th className="px-2 py-2 text-right">Mat. Prev.</th>
                <th className="px-2 py-2 text-right">MO Real.</th>
                <th className="px-2 py-2 text-right">Mat. Cons.</th>
                <th className="px-2 py-2 text-right">Equip.</th>
                <th className="px-2 py-2 text-right">Realizado</th>
                <th className="px-2 py-2 text-right">Saldo Meta</th>
                <th className="px-2 py-2 text-right">Lucro Atual</th>
                <th className="px-2 py-2 text-right">Margem %</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.row.item} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1 font-mono">{l.row.item}</td>
                  <td className="px-2 py-1 font-mono">{l.row.codigo}</td>
                  <td className="px-2 py-1">{l.row.banco}</td>
                  <td className="px-2 py-1 max-w-md truncate" title={l.row.descricao}>
                    {l.row.descricao}
                  </td>
                  <td className="px-2 py-1">{l.row.und}</td>
                  <td className="px-2 py-1 text-right">{fmtNum(l.row.quantidade)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.calc.precoVendaTotal)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.calc.impostosNota)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.calc.lucroPlanejado)}</td>
                  <td className="px-2 py-1 text-right font-medium">
                    {fmtBRL(l.calc.custoMeta)}
                  </td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.moPrevisto)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.matPrevisto)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.moReal)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.matReal)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.eqReal)}</td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.realizadoTotal)}</td>
                  <td
                    className={`px-2 py-1 text-right font-semibold ${
                      l.saldoMeta < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {fmtBRL(l.saldoMeta)}
                  </td>
                  <td className="px-2 py-1 text-right">{fmtBRL(l.lucroAtual)}</td>
                  <td className="px-2 py-1 text-right">{fmtNum(l.margemAtual)}%</td>
                  <td className="px-2 py-1">
                    {l.status === "dentro" && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        Dentro da Meta
                      </Badge>
                    )}
                    {l.status === "atencao" && (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-black">
                        Atenção
                      </Badge>
                    )}
                    {l.status === "acima" && (
                      <Badge variant="destructive">Acima do Custo Meta</Badge>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMemoria(l.row)}
                      title="Memória de cálculo"
                    >
                      <Calculator className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={21} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhuma composição encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <MemoriaCalculoDialog
        row={memoria}
        params={params}
        onClose={() => setMemoria(null)}
        getRealizado={(r) => {
          const l = linhas.find((x) => x.row.item === r.item);
          return l?.realizadoTotal ?? 0;
        }}
      />
    </div>
  );
}

function MemoriaCalculoDialog({
  row,
  params,
  onClose,
  getRealizado,
}: {
  row: BudgetRow | null;
  params: MetaParams;
  onClose: () => void;
  getRealizado: (r: BudgetRow) => number;
}) {
  if (!row) return null;
  const calc = computeMetaCalc(row, params);
  const realizado = getRealizado(row);
  const saldoMeta = calc.custoMeta - realizado;
  const lucroAtual = calc.precoVendaTotal - calc.impostosNota - realizado;
  const margemAtual =
    calc.precoVendaTotal > 0 ? (lucroAtual / calc.precoVendaTotal) * 100 : 0;

  const Line = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between py-1 border-b border-border/40 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-medium">{v}</span>
    </div>
  );

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Memória de Cálculo</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {row.item} — {row.descricao}
          </p>
        </DialogHeader>
        <div className="space-y-1">
          <Line k="Preço Venda Total" v={fmtBRL(calc.precoVendaTotal)} />
          <Line k="% Tributos" v={`${fmtNum(calc.tributosPercent)}%`} />
          <Line k="Valor Tributos" v={fmtBRL(calc.impostosNota)} />
          <Line k="% Lucro Pretendido" v={`${fmtNum(calc.lucroPercent)}%`} />
          <Line k="Lucro Planejado" v={fmtBRL(calc.lucroPlanejado)} />
          <Line k="Custo Meta" v={fmtBRL(calc.custoMeta)} />
          <Line k="Realizado Total" v={fmtBRL(realizado)} />
          <Line k="Saldo Meta" v={fmtBRL(saldoMeta)} />
          <Line k="Lucro Atual" v={fmtBRL(lucroAtual)} />
          <Line k="Margem Atual" v={`${fmtNum(margemAtual)}%`} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
