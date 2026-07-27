import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listSubContratos, saveSubContrato, deleteSubContrato, listSubempreiteiros,
} from "@/lib/subempreiteiros/api.functions";

export const Route = createFileRoute("/_app/subempreiteiros/contratos")({
  component: Page,
  head: () => ({ meta: [{ title: "Subempreiteiros — Contratos" }] }),
});

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type Ct = Record<string, unknown> & { id: string };

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubContratos);
  const saveFn = useServerFn(saveSubContrato);
  const delFn = useServerFn(deleteSubContrato);
  const listSubs = useServerFn(listSubempreiteiros);

  const { data = [] } = useQuery({ queryKey: ["sub-contratos"], queryFn: () => listFn({ data: {} }) });
  const { data: subs = [] } = useQuery({ queryKey: ["subempresas"], queryFn: () => listSubs() });
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id,nome,codigo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const empty = { numero: "", obra_id: "", subempreiteiro_id: "", valor_maximo: 0, objeto: "", status: "em_andamento" as const };
  const [form, setForm] = useState<Record<string, unknown>>(empty);
  const upd = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await saveFn({ data: { ...form, valor_maximo: Number(form.valor_maximo ?? 0) } as never });
      toast.success("Contrato salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sub-contratos"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir contrato?")) return;
    try { await delFn({ data: { id } }); qc.invalidateQueries({ queryKey: ["sub-contratos"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSignature className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold">Contratos de subempreitada</h1>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo contrato
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Nº</th><th className="p-3">Obra</th>
              <th className="p-3">Subempreiteiro</th><th className="p-3">Valor máximo</th>
              <th className="p-3">Status</th><th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {(data as Ct[]).map((c) => {
              const obra = c.obra as { nome?: string; codigo?: string } | null;
              const sub = c.sub as { razao_social?: string } | null;
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{c.numero as string}</td>
                  <td className="p-3">{obra?.nome ?? "—"}</td>
                  <td className="p-3">{sub?.razao_social ?? "—"}</td>
                  <td className="p-3">{brl(Number(c.valor_maximo ?? 0))}</td>
                  <td className="p-3 uppercase text-xs">{c.status as string}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/subempreiteiros/medicoes">Medições</Link>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Nenhum contrato.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <F label="Número *"><Input value={String(form.numero ?? "")} onChange={(e) => upd("numero", e.target.value)} /></F>
            <F label="Valor máximo *"><Input type="number" step="0.01" value={String(form.valor_maximo ?? "")} onChange={(e) => upd("valor_maximo", e.target.value)} /></F>
            <F label="Obra *" className="col-span-2">
              <Select value={String(form.obra_id ?? "")} onValueChange={(v) => upd("obra_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  {(obras as Array<{ id: string; nome: string }>).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
            <F label="Subempreiteiro *" className="col-span-2">
              <Select value={String(form.subempreiteiro_id ?? "")} onValueChange={(v) => upd("subempreiteiro_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {(subs as Array<{ id: string; razao_social: string }>).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
            <F label="Objeto" className="col-span-2"><Textarea value={String(form.objeto ?? "")} onChange={(e) => upd("objeto", e.target.value)} /></F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
