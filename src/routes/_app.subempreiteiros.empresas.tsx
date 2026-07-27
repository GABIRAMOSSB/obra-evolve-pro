import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import {
  listSubempreiteiros, saveSubempreiteiro, deleteSubempreiteiro,
} from "@/lib/subempreiteiros/api.functions";

export const Route = createFileRoute("/_app/subempreiteiros/empresas")({
  component: Page,
  head: () => ({ meta: [{ title: "Subempreiteiros — Empresas" }] }),
});

type Empresa = Record<string, unknown> & { id: string; razao_social: string };

function emptyForm(): Partial<Empresa> {
  return { razao_social: "", nome_fantasia: "", cnpj: "", responsavel: "", telefone: "", email: "", cidade: "", uf: "", pix: "", ativo: true };
}

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubempreiteiros);
  const saveFn = useServerFn(saveSubempreiteiro);
  const delFn = useServerFn(deleteSubempreiteiro);
  const { data = [] } = useQuery({ queryKey: ["subempresas"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Empresa>>(emptyForm());

  const upd = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.razao_social || (form.razao_social as string).length < 2) {
      toast.error("Razão social é obrigatória");
      return;
    }
    try {
      await saveFn({ data: form as never });
      toast.success("Empresa salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["subempresas"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta empresa?")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["subempresas"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold">Empresas subempreiteiras</h1>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova empresa
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Razão social</th>
              <th className="p-3">CNPJ</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Cidade/UF</th>
              <th className="p-3">Contato</th>
              <th className="p-3 w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data as Empresa[]).map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{e.razao_social as string}</td>
                <td className="p-3">{(e.cnpj as string) ?? "—"}</td>
                <td className="p-3">{(e.responsavel as string) ?? "—"}</td>
                <td className="p-3">{[(e.cidade as string), (e.uf as string)].filter(Boolean).join("/") || "—"}</td>
                <td className="p-3">{(e.telefone as string) ?? (e.email as string) ?? "—"}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setForm(e); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Nenhuma empresa cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar empresa" : "Nova empresa"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Razão social *"><Input value={(form.razao_social as string) ?? ""} onChange={(e) => upd("razao_social", e.target.value)} /></Field>
            <Field label="Nome fantasia"><Input value={(form.nome_fantasia as string) ?? ""} onChange={(e) => upd("nome_fantasia", e.target.value)} /></Field>
            <Field label="CNPJ"><Input value={(form.cnpj as string) ?? ""} onChange={(e) => upd("cnpj", e.target.value)} /></Field>
            <Field label="Responsável"><Input value={(form.responsavel as string) ?? ""} onChange={(e) => upd("responsavel", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={(form.telefone as string) ?? ""} onChange={(e) => upd("telefone", e.target.value)} /></Field>
            <Field label="E-mail"><Input value={(form.email as string) ?? ""} onChange={(e) => upd("email", e.target.value)} /></Field>
            <Field label="Cidade"><Input value={(form.cidade as string) ?? ""} onChange={(e) => upd("cidade", e.target.value)} /></Field>
            <Field label="UF"><Input maxLength={2} value={(form.uf as string) ?? ""} onChange={(e) => upd("uf", e.target.value.toUpperCase())} /></Field>
            <Field label="Banco"><Input value={(form.banco as string) ?? ""} onChange={(e) => upd("banco", e.target.value)} /></Field>
            <Field label="Ag/Conta"><Input value={(form.conta as string) ?? ""} onChange={(e) => upd("conta", e.target.value)} /></Field>
            <Field label="Chave Pix" className="col-span-2"><Input value={(form.pix as string) ?? ""} onChange={(e) => upd("pix", e.target.value)} /></Field>
            <Field label="Observações" className="col-span-2"><Textarea value={(form.observacoes as string) ?? ""} onChange={(e) => upd("observacoes", e.target.value)} /></Field>
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

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
