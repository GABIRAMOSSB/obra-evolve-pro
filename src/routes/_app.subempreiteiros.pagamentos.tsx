import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet } from "lucide-react";
import {
  listSubPagamentos, saveSubPagamento, deleteSubPagamento, listSubMedicoes,
} from "@/lib/subempreiteiros/api.functions";

export const Route = createFileRoute("/_app/subempreiteiros/pagamentos")({
  component: Page,
  head: () => ({ meta: [{ title: "Subempreiteiros — Pagamentos" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
type Pg = Record<string, unknown> & { id: string };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubPagamentos);
  const saveFn = useServerFn(saveSubPagamento);
  const delFn = useServerFn(deleteSubPagamento);
  const listMed = useServerFn(listSubMedicoes);
  const { data = [] } = useQuery({ queryKey: ["sub-pgs"], queryFn: () => listFn() });
  const { data: meds = [] } = useQuery({ queryKey: ["sub-medicoes"], queryFn: () => listMed() });

  const [open, setOpen] = useState(false);
  const empty = { medicao_id: "", data_pagamento: new Date().toISOString().slice(0, 10), forma: "pix" as const, valor_pago: 0, numero_comprovante: "", observacoes: "" };
  const [form, setForm] = useState<Record<string, unknown>>(empty);
  const upd = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await saveFn({ data: { ...form, valor_pago: Number(form.valor_pago ?? 0) } as never });
      toast.success("Pagamento registrado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-pgs"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir pagamento?")) return;
    try { await delFn({ data: { id } }); qc.invalidateQueries({ queryKey: ["sub-pgs"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold">Pagamentos</h1>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Data</th><th className="p-3">Medição</th>
              <th className="p-3">Forma</th><th className="p-3">Comprovante</th>
              <th className="p-3">Valor</th><th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {(data as Pg[]).map((p) => {
              const m = p.medicao as { numero?: number; contrato?: { obra?: { nome?: string }; sub?: { razao_social?: string } } } | null;
              return (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{p.data_pagamento as string}</td>
                  <td className="p-3">#{m?.numero} — {m?.contrato?.obra?.nome ?? ""} / {m?.contrato?.sub?.razao_social ?? ""}</td>
                  <td className="p-3 uppercase text-xs">{p.forma as string}</td>
                  <td className="p-3">{(p.numero_comprovante as string) ?? "—"}</td>
                  <td className="p-3">{brl(Number(p.valor_pago ?? 0))}</td>
                  <td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button></td>
                </tr>
              );
            })}
            {data.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Nenhum pagamento.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo pagamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Medição</Label>
              <Select value={String(form.medicao_id ?? "")} onValueChange={(v) => upd("medicao_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(meds as Array<Record<string, unknown>>).map((m) => {
                    const ct = m.contrato as { obra?: { nome?: string }; sub?: { razao_social?: string } } | null;
                    return <SelectItem key={m.id as string} value={m.id as string}>
                      #{m.numero as number} — {ct?.obra?.nome ?? ""} / {ct?.sub?.razao_social ?? ""} — {brl(Number(m.valor_liquido ?? 0))}
                    </SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={String(form.data_pagamento ?? "")} onChange={(e) => upd("data_pagamento", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor pago</Label>
              <Input type="number" step="0.01" value={String(form.valor_pago ?? "")} onChange={(e) => upd("valor_pago", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Forma</Label>
              <Select value={String(form.forma ?? "pix")} onValueChange={(v) => upd("forma", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pix", "ted", "doc", "transferencia", "cheque", "dinheiro"].map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comprovante</Label>
              <Input value={String(form.numero_comprovante ?? "")} onChange={(e) => upd("numero_comprovante", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
