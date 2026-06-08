import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/composicoes")({
  component: ComposicoesPage,
  head: () => ({
    meta: [
      { title: "Composições Próprias" },
      { name: "description", content: "Cadastro de composições próprias para uso em orçamentos." },
    ],
  }),
});

interface Composicao {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  custo_total: number;
  observacoes: string | null;
  ativo: boolean;
}
interface InsumoLinha {
  id?: string;
  descricao: string;
  unidade: string;
  coeficiente: number;
  custo_unitario: number;
  ordem: number;
}

function fmtMoney(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const COMPOSICOES_PAGE_SIZE = 25;

function ComposicoesPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [lista, setLista] = useState<Composicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Composicao | null>(null);
  const [form, setForm] = useState({ codigo: "", descricao: "", unidade: "UN", observacoes: "" });
  const [insumos, setInsumos] = useState<InsumoLinha[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", search: { redirect: undefined } });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("composicoes_proprias")
      .select("*")
      .eq("company_id", company.id)
      .order("codigo");
    if (error) toast.error("Falha ao carregar composições");
    else setLista((data as Composicao[]) ?? []);
    setLoading(false);
  }, [company]);

  useEffect(() => { if (company) load(); }, [company, load]);

  const openNew = () => {
    setEditing({ id: "", codigo: "", descricao: "", unidade: "UN", custo_total: 0, observacoes: null, ativo: true });
    setForm({ codigo: "", descricao: "", unidade: "UN", observacoes: "" });
    setInsumos([]);
  };

  const openEdit = async (c: Composicao) => {
    setEditing(c);
    setForm({ codigo: c.codigo, descricao: c.descricao, unidade: c.unidade, observacoes: c.observacoes ?? "" });
    const { data } = await supabase
      .from("composicoes_proprias_insumos")
      .select("id, descricao, unidade, coeficiente, custo_unitario, ordem")
      .eq("composicao_id", c.id)
      .order("ordem");
    setInsumos(
      ((data as Array<{ id: string; descricao: string; unidade: string | null; coeficiente: number; custo_unitario: number; ordem: number }>) ?? []).map((x) => ({
        id: x.id,
        descricao: x.descricao,
        unidade: x.unidade ?? "UN",
        coeficiente: Number(x.coeficiente),
        custo_unitario: Number(x.custo_unitario),
        ordem: x.ordem,
      })),
    );
  };

  const addInsumo = () => setInsumos((p) => [...p, { descricao: "", unidade: "UN", coeficiente: 1, custo_unitario: 0, ordem: p.length }]);
  const updateInsumo = (i: number, patch: Partial<InsumoLinha>) =>
    setInsumos((p) => p.map((x, ix) => (ix === i ? { ...x, ...patch } : x)));
  const removeInsumo = (i: number) => setInsumos((p) => p.filter((_, ix) => ix !== i));

  const custoTotal = insumos.reduce((acc, ins) => acc + Number(ins.coeficiente || 0) * Number(ins.custo_unitario || 0), 0);

  const handleSave = async () => {
    if (!company || !editing) return;
    if (!form.codigo.trim() || !form.descricao.trim()) {
      toast.error("Código e descrição são obrigatórios");
      return;
    }
    try {
      let compId = editing.id;
      if (!compId) {
        const { data, error } = await supabase
          .from("composicoes_proprias")
          .insert({
            company_id: company.id,
            codigo: form.codigo.trim(),
            descricao: form.descricao.trim(),
            unidade: form.unidade.trim() || "UN",
            observacoes: form.observacoes.trim() || null,
            custo_total: custoTotal,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        compId = (data as { id: string }).id;
      } else {
        const { error } = await supabase
          .from("composicoes_proprias")
          .update({
            codigo: form.codigo.trim(),
            descricao: form.descricao.trim(),
            unidade: form.unidade.trim() || "UN",
            observacoes: form.observacoes.trim() || null,
            custo_total: custoTotal,
          })
          .eq("id", compId);
        if (error) throw error;
        // Replace all insumos
        await supabase.from("composicoes_proprias_insumos").delete().eq("composicao_id", compId);
      }
      if (insumos.length > 0) {
        const { error } = await supabase.from("composicoes_proprias_insumos").insert(
          insumos.map((ins, ix) => ({
            company_id: company.id,
            composicao_id: compId,
            descricao: ins.descricao,
            unidade: ins.unidade,
            coeficiente: ins.coeficiente,
            custo_unitario: ins.custo_unitario,
            ordem: ix,
          })),
        );
        if (error) throw error;
      }
      toast.success("Composição salva");
      setEditing(null);
      load();
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error("Falha ao salvar: " + ((err as any)?.message ?? ""));
    }
  };

  const handleDelete = async (c: Composicao) => {
    if (!window.confirm(`Apagar composição ${c.codigo} — ${c.descricao}?`)) return;
    const { error } = await supabase.from("composicoes_proprias").delete().eq("id", c.id);
    if (error) toast.error("Falha ao apagar");
    else { toast.success("Composição apagada"); load(); }
  };

  const handleDuplicate = async (c: Composicao) => {
    if (!company) return;
    const { data: insOrig } = await supabase
      .from("composicoes_proprias_insumos")
      .select("descricao, unidade, coeficiente, custo_unitario, ordem")
      .eq("composicao_id", c.id);
    const { data: nova, error } = await supabase
      .from("composicoes_proprias")
      .insert({
        company_id: company.id,
        codigo: `${c.codigo}-CP`,
        descricao: `${c.descricao} (cópia)`,
        unidade: c.unidade,
        observacoes: c.observacoes,
        custo_total: c.custo_total,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error) { toast.error("Falha ao duplicar"); return; }
    if (insOrig && insOrig.length > 0) {
      await supabase.from("composicoes_proprias_insumos").insert(
        insOrig.map((x) => ({ ...x, company_id: company.id, composicao_id: (nova as { id: string }).id })),
      );
    }
    toast.success("Composição duplicada");
    load();
  };

  const filtradas = lista.filter(
    (c) => !filtro || c.codigo.toLowerCase().includes(filtro.toLowerCase()) || c.descricao.toLowerCase().includes(filtro.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtradas.length / COMPOSICOES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const composicoesPaginadas = filtradas.slice(
    (safePage - 1) * COMPOSICOES_PAGE_SIZE,
    safePage * COMPOSICOES_PAGE_SIZE,
  );

  if (authLoading || companyLoading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
            </Button>
            <h1 className="text-xl font-semibold">Composições Próprias</h1>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova composição</Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por codigo ou descricao..."
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Und</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma composição cadastrada</TableCell></TableRow>
              ) : (
                composicoesPaginadas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell>{c.unidade}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(c.custo_total))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(c)} title="Duplicar"><Copy className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)} title="Apagar"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtradas.length > COMPOSICOES_PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>Mostrando {composicoesPaginadas.length} de {filtradas.length} composicoes</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <span className="min-w-20 text-center">Pagina {safePage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                  Proxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar composição" : "Nova composição"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <Label className="text-xs">Código *</Label>
                <Input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
              </div>
              <div className="col-span-7">
                <Label className="text-xs">Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Unidade</Label>
                <Input value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>

            <div className="border rounded-md">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-sm font-semibold">Insumos da composição</h3>
                <Button size="sm" variant="outline" onClick={addInsumo}><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20">Und</TableHead>
                    <TableHead className="w-28 text-right">Coef.</TableHead>
                    <TableHead className="w-32 text-right">Custo unit.</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Adicione insumos</TableCell></TableRow>
                  ) : (
                    insumos.map((ins, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={ins.descricao} onChange={(e) => updateInsumo(i, { descricao: e.target.value })} /></TableCell>
                        <TableCell><Input value={ins.unidade} onChange={(e) => updateInsumo(i, { unidade: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" step="any" className="text-right" value={ins.coeficiente} onChange={(e) => updateInsumo(i, { coeficiente: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="any" className="text-right" value={ins.custo_unitario} onChange={(e) => updateInsumo(i, { custo_unitario: Number(e.target.value) })} /></TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtMoney(Number(ins.coeficiente) * Number(ins.custo_unitario))}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeInsumo(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end p-3 border-t bg-muted/30">
                <div className="text-sm font-semibold">Custo total: {fmtMoney(custoTotal)}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
