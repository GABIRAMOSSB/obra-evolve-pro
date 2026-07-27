import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus } from "lucide-react";
import {
  listSubMedicoes, createSubMedicao, listSubContratos,
} from "@/lib/subempreiteiros/api.functions";

export const Route = createFileRoute("/_app/subempreiteiros/medicoes")({
  component: Page,
  head: () => ({ meta: [{ title: "Subempreiteiros — Medições" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
type Med = Record<string, unknown> & { id: string };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubMedicoes);
  const createFn = useServerFn(createSubMedicao);
  const listCt = useServerFn(listSubContratos);
  const { data = [] } = useQuery({ queryKey: ["sub-medicoes"], queryFn: () => listFn() });
  const { data: contratos = [] } = useQuery({ queryKey: ["sub-contratos"], queryFn: () => listCt({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [contratoId, setContratoId] = useState("");
  const [competencia, setCompetencia] = useState("");

  const criar = async () => {
    if (!contratoId) return toast.error("Selecione o contrato");
    try {
      const r = await createFn({ data: { contrato_id: contratoId, competencia } });
      toast.success(`Medição #${r.numero} criada`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-medicoes"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold">Medições de subempreiteiros</h1>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nova medição</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Nº</th><th className="p-3">Data</th>
              <th className="p-3">Obra / Sub</th><th className="p-3">Bruto</th>
              <th className="p-3">Líquido</th><th className="p-3">Status</th>
              <th className="p-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {(data as Med[]).map((m) => {
              const ct = m.contrato as { numero?: string; obra?: { nome?: string }; sub?: { razao_social?: string } } | null;
              return (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">#{m.numero as number}</td>
                  <td className="p-3">{(m.data_medicao as string) ?? "—"}</td>
                  <td className="p-3">{ct?.obra?.nome ?? "—"} · {ct?.sub?.razao_social ?? "—"}</td>
                  <td className="p-3">{brl(Number(m.valor_bruto ?? 0))}</td>
                  <td className="p-3">{brl(Number(m.valor_liquido ?? 0))}</td>
                  <td className="p-3 uppercase text-xs">{m.status as string}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/subempreiteiros/medicoes/$id" params={{ id: m.id }}>Abrir</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">Nenhuma medição.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova medição</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Contrato</Label>
              <Select value={contratoId} onValueChange={setContratoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(contratos as Array<Record<string, unknown>>).map((c) => {
                    const obra = c.obra as { nome?: string } | null;
                    const sub = c.sub as { razao_social?: string } | null;
                    return <SelectItem key={c.id as string} value={c.id as string}>
                      {(c.numero as string)} — {obra?.nome ?? ""} / {sub?.razao_social ?? ""}
                    </SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Competência (ex: 2026-07)</Label>
              <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="2026-07" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={criar}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
