import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getSubDashboard } from "@/lib/subempreiteiros/api.functions";
import { HardHat } from "lucide-react";

export const Route = createFileRoute("/_app/subempreiteiros/dashboard")({
  component: Page,
  head: () => ({ meta: [{ title: "Subempreiteiros — Dashboard" }] }),
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function Page() {
  const fn = useServerFn(getSubDashboard);
  const { data } = useQuery({ queryKey: ["sub-dash"], queryFn: () => fn() });

  const kpis = [
    { label: "Total contratado", value: brl(data?.total_contratado ?? 0) },
    { label: "Total medido (bruto)", value: brl(data?.total_medido ?? 0) },
    { label: "Aprovado (líquido)", value: brl(data?.total_aprovado ?? 0) },
    { label: "Pago", value: brl(data?.total_pago ?? 0) },
    { label: "Saldo contratual", value: brl(data?.saldo_contratual ?? 0) },
    { label: "Saldo a pagar", value: brl(data?.saldo_a_pagar ?? 0) },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <HardHat className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-semibold">Subempreiteiros — Painel</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="text-xl font-semibold mt-1">{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Análise de lucratividade (por serviço executado)</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Metric label="Receita (cliente)" value={brl(data?.receita ?? 0)} />
          <Metric label="Custo (subempreiteiro)" value={brl(data?.custo ?? 0)} />
          <Metric label="Lucro bruto" value={brl(data?.lucro ?? 0)} highlight />
          <Metric label="Margem" value={`${(data?.margem ?? 0).toFixed(2)}%`} />
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        {data?.contratos_count ?? 0} contrato(s) · {data?.medicoes_count ?? 0} medição(ões)
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
