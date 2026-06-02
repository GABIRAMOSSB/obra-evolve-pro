import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/parametros-financeiros")({
  component: ParametrosFinanceirosPage,
  head: () => ({
    meta: [
      { title: "Parâmetros Financeiros / Encargos" },
      {
        name: "description",
        content:
          "Parametrização de tributos sobre nota fiscal, lucro pretendido e encargos de mão de obra (Lucro Presumido).",
      },
    ],
  }),
});

interface Params {
  iss_percent: number;
  pis_percent: number;
  cofins_percent: number;
  irpj_percent: number;
  csll_percent: number;
  lucro_pretendido_percent: number;
  encargos_mao_obra_percent: number;
}

const DEFAULTS: Params = {
  iss_percent: 5.0,
  pis_percent: 0.65,
  cofins_percent: 3.0,
  irpj_percent: 4.8,
  csll_percent: 2.88,
  lucro_pretendido_percent: 25.0,
  encargos_mao_obra_percent: 100.0,
};

function fmtPct(n: number) {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function ParametrosFinanceirosPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const isEditor =
    company?.role === "admin" || company?.role === "editor";

  const [params, setParams] = useState<Params>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("parametros_financeiros")
      .select("*")
      .eq("company_id", company.id)
      .maybeSingle();
    if (error) {
      toast.error("Falha ao carregar parâmetros");
    } else if (data) {
      setParams({
        iss_percent: Number(data.iss_percent),
        pis_percent: Number(data.pis_percent),
        cofins_percent: Number(data.cofins_percent),
        irpj_percent: Number(data.irpj_percent),
        csll_percent: Number(data.csll_percent),
        lucro_pretendido_percent: Number(data.lucro_pretendido_percent),
        encargos_mao_obra_percent: Number(data.encargos_mao_obra_percent),
      });
    }
    setLoading(false);
  }, [company]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTributos =
    params.iss_percent +
    params.pis_percent +
    params.cofins_percent +
    params.irpj_percent +
    params.csll_percent;

  const handleSave = async () => {
    if (!company || !isEditor) return;
    setSaving(true);
    const { error } = await supabase
      .from("parametros_financeiros")
      .upsert(
        {
          company_id: company.id,
          ...params,
          updated_by: user?.id,
        },
        { onConflict: "company_id" },
      );
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Falha ao salvar parâmetros");
    } else {
      toast.success("Parâmetros salvos");
    }
  };

  const set = (k: keyof Params) => (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    setParams((p) => ({ ...p, [k]: Number.isFinite(n) ? n : 0 }));
  };

  if (authLoading || companyLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Você precisa estar vinculado a uma empresa.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" /> Obras
              </Link>
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <Calculator className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-lg font-semibold truncate">
                Parâmetros Financeiros / Encargos
              </h1>
            </div>
          </div>
          {isEditor && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </div>
      </header>

      <main className="w-full max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base">
              1. Encargos sobre Nota Fiscal — Lucro Presumido
            </h2>
            <p className="text-xs text-muted-foreground">
              Tributos aplicados sobre o valor total da nota fiscal / preço de
              venda. Sem dedução de materiais.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field
              label="ISS (%)"
              value={params.iss_percent}
              onChange={set("iss_percent")}
              disabled={!isEditor}
            />
            <Field
              label="PIS (%)"
              value={params.pis_percent}
              onChange={set("pis_percent")}
              disabled={!isEditor}
            />
            <Field
              label="COFINS (%)"
              value={params.cofins_percent}
              onChange={set("cofins_percent")}
              disabled={!isEditor}
            />
            <Field
              label="IRPJ (%)"
              value={params.irpj_percent}
              onChange={set("irpj_percent")}
              disabled={!isEditor}
            />
            <Field
              label="CSLL (%)"
              value={params.csll_percent}
              onChange={set("csll_percent")}
              disabled={!isEditor}
            />
            <div className="rounded-md border bg-muted/40 p-3 flex flex-col justify-center">
              <span className="text-xs text-muted-foreground">
                Total de Tributos sobre Nota
              </span>
              <span className="text-lg font-semibold text-primary">
                {fmtPct(totalTributos)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base">2. Lucro Pretendido</h2>
            <p className="text-xs text-muted-foreground">
              Lucro Planejado = Preço de Venda × Lucro Pretendido (%).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field
              label="Lucro Pretendido (%)"
              value={params.lucro_pretendido_percent}
              onChange={set("lucro_pretendido_percent")}
              disabled={!isEditor}
            />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base">3. Encargos de Mão de Obra</h2>
            <p className="text-xs text-muted-foreground">
              Custo Real da MO = Valor da MO × (1 + Encargos de MO %). Ex.: MO
              R$ 1.000 com 100% → custo real R$ 2.000.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field
              label="Encargos de Mão de Obra (%)"
              value={params.encargos_mao_obra_percent}
              onChange={set("encargos_mao_obra_percent")}
              disabled={!isEditor}
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-base">Exemplo prático</h2>
          <Separator />
          <ExemploPratico
            tributos={totalTributos}
            lucro={params.lucro_pretendido_percent}
          />
        </Card>

        {!isEditor && (
          <p className="text-xs text-muted-foreground text-center">
            Somente administradores ou editores podem alterar estes parâmetros.
          </p>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.01"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function ExemploPratico({
  tributos,
  lucro,
}: {
  tributos: number;
  lucro: number;
}) {
  const venda = 100000;
  const vTrib = venda * (tributos / 100);
  const vLuc = venda * (lucro / 100);
  const meta = venda - vTrib - vLuc;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <Item label="Preço de Venda" value={fmt(venda)} />
      <Item label="Impostos Nota" value={fmt(vTrib)} sub={fmtPct(tributos)} />
      <Item label="Lucro" value={fmt(vLuc)} sub={fmtPct(lucro)} />
      <Item label="Custo Meta" value={fmt(meta)} highlight />
    </div>
  );
}

function Item({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${highlight ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}
    >
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`font-semibold ${highlight ? "text-primary" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
