import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, PenTool, Save, Lock } from "lucide-react";
import {
  getSubMedicaoDetalhe, updateSubMedicaoItem, recalcSubMedicao,
  setSubMedicaoStatus, signSubMedicao,
} from "@/lib/subempreiteiros/api.functions";

export const Route = createFileRoute("/_app/subempreiteiros/medicoes_/$id")({
  component: Page,
  head: () => ({ meta: [{ title: "Medição — Subempreiteiro" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getSubMedicaoDetalhe);
  const updItem = useServerFn(updateSubMedicaoItem);
  const recalcFn = useServerFn(recalcSubMedicao);
  const statusFn = useServerFn(setSubMedicaoStatus);
  const signFn = useServerFn(signSubMedicao);

  const { data } = useQuery({ queryKey: ["sub-med", id], queryFn: () => getFn({ data: { id } }) });
  const med = data?.medicao as Record<string, unknown> | undefined;
  const itens = (data?.itens ?? []) as Array<Record<string, unknown>>;
  const locked = med?.locked_at != null || med?.status === "assinada" || med?.status === "paga";

  const [ret, setRet] = useState({ inss: 0, iss: 0, irrf: 0, outras: 0, observacoes: "", responsavel_conferencia: "" });
  useEffect(() => {
    if (med) setRet({
      inss: Number(med.ret_inss ?? 0), iss: Number(med.ret_iss ?? 0),
      irrf: Number(med.ret_irrf ?? 0), outras: Number(med.ret_outras ?? 0),
      observacoes: (med.observacoes as string) ?? "",
      responsavel_conferencia: (med.responsavel_conferencia as string) ?? "",
    });
  }, [med]);

  const [signOpen, setSignOpen] = useState(false);
  const [signName, setSignName] = useState("");
  const sigRef = useRef<SignatureCanvas | null>(null);

  const saveItem = async (itemId: string, qtd: number) => {
    try {
      await updItem({ data: { id: itemId, qtd_periodo: qtd } });
      qc.invalidateQueries({ queryKey: ["sub-med", id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const recalc = async () => {
    try {
      await recalcFn({ data: { id, ret_inss: ret.inss, ret_iss: ret.iss, ret_irrf: ret.irrf, ret_outras: ret.outras, observacoes: ret.observacoes, responsavel_conferencia: ret.responsavel_conferencia } });
      toast.success("Totais atualizados");
      qc.invalidateQueries({ queryKey: ["sub-med", id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const doSign = async () => {
    const canvas = sigRef.current;
    if (!canvas || canvas.isEmpty()) return toast.error("Assine antes de confirmar");
    if (signName.trim().length < 2) return toast.error("Informe o nome do signatário");
    try {
      const base64 = canvas.getCanvas().toDataURL("image/png");
      await signFn({ data: { id, assinatura_base64: base64, assinatura_nome: signName.trim() } });
      toast.success("Medição assinada e travada");
      setSignOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-med", id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/subempreiteiros/medicoes"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <h1 className="text-2xl font-display font-semibold">
            Medição #{med?.numero as number} {locked && <Lock className="inline w-4 h-4 ml-2 text-muted-foreground" />}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recalc} disabled={!!locked}><Save className="w-4 h-4 mr-1" /> Recalcular</Button>
          <Button variant="outline" onClick={() => statusFn({ data: { id, status: "aguardando_assinatura" } }).then(() => qc.invalidateQueries({ queryKey: ["sub-med", id] }))} disabled={!!locked}>
            Enviar p/ assinatura
          </Button>
          <Button onClick={() => setSignOpen(true)} disabled={!!locked}><PenTool className="w-4 h-4 mr-1" /> Assinar</Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Valor bruto" value={brl(Number(med?.valor_bruto ?? 0))} />
        <Kpi label="Retenções" value={brl(ret.inss + ret.iss + ret.irrf + ret.outras)} />
        <Kpi label="Valor líquido" value={brl(Number(med?.valor_liquido ?? 0))} highlight />
        <Kpi label="Status" value={String(med?.status ?? "—").toUpperCase()} />
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">Item</th><th className="p-2">Descrição</th><th className="p-2">Und</th>
              <th className="p-2">Contrat.</th><th className="p-2">Anterior</th>
              <th className="p-2">Período</th><th className="p-2">P.Unit</th><th className="p-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const s = it.servico as { codigo?: string; descricao?: string; unidade?: string; qtd_contratada?: number } | null;
              return (
                <tr key={it.id as string} className="border-t">
                  <td className="p-2">{s?.codigo ?? "—"}</td>
                  <td className="p-2">{s?.descricao}</td>
                  <td className="p-2">{s?.unidade}</td>
                  <td className="p-2">{Number(s?.qtd_contratada ?? 0)}</td>
                  <td className="p-2">{Number(it.qtd_anterior ?? 0)}</td>
                  <td className="p-2 w-28">
                    <Input type="number" step="0.01" defaultValue={String(it.qtd_periodo ?? 0)}
                      disabled={!!locked}
                      onBlur={(e) => saveItem(it.id as string, Number(e.target.value))} />
                  </td>
                  <td className="p-2">{brl(Number(it.preco_unitario ?? 0))}</td>
                  <td className="p-2">{brl(Number(it.valor ?? 0))}</td>
                </tr>
              );
            })}
            {itens.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sem itens.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Retenções e conferência</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["inss", "iss", "irrf", "outras"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs uppercase">{k}</Label>
              <Input type="number" step="0.01" value={ret[k]} disabled={!!locked}
                onChange={(e) => setRet({ ...ret, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Responsável pela conferência</Label>
            <Input value={ret.responsavel_conferencia} disabled={!!locked}
              onChange={(e) => setRet({ ...ret, responsavel_conferencia: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Input value={ret.observacoes} disabled={!!locked}
              onChange={(e) => setRet({ ...ret, observacoes: e.target.value })} />
          </div>
        </div>
      </Card>

      {med?.assinatura_base64 && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Assinatura registrada — {String(med.assinatura_nome ?? "")}</div>
          <img src={String(med.assinatura_base64)} alt="assinatura" className="max-h-32 border rounded bg-white" />
        </Card>
      )}

      {signOpen && !locked && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="p-4 w-full max-w-lg space-y-3">
            <div className="text-lg font-semibold">Assinatura digital</div>
            <div className="space-y-1">
              <Label className="text-xs">Nome do signatário</Label>
              <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
            </div>
            <div className="border rounded bg-white">
              <SignatureCanvas ref={sigRef} canvasProps={{ width: 480, height: 180, className: "w-full" }} />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => sigRef.current?.clear()}>Limpar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSignOpen(false)}>Cancelar</Button>
                <Button onClick={doSign}>Confirmar assinatura</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
