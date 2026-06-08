import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, Pencil, Wrench } from "lucide-react";

export const Route = createFileRoute("/_app/equipamentos")({
  component: EquipamentosPage,
  head: () => ({
    meta: [
      { title: "Cadastro de Equipamentos" },
      {
        name: "description",
        content:
          "Cadastro de equipamentos e custos por hora utilizados no diário de obra.",
      },
    ],
  }),
});

interface Equipamento {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  unidade: string | null;
  custo_hora: number;
  custo_hora_extra: number | null;
  ativo: boolean;
  observacoes: string | null;
}

function fmtMoney(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const EQUIPAMENTOS_PAGE_SIZE = 25;

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  tipo: "proprio",
  unidade: "H",
  custo_hora: "0",
  custo_hora_extra: "",
  ativo: true,
  observacoes: "",
};

function EquipamentosPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [items, setItems] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Equipamento | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const canEdit = company?.role === "admin" || company?.role === "editor";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", search: { redirect: undefined } });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("equipamentos")
      .select("*")
      .eq("company_id", company.id)
      .order("nome");
    if (error) {
      toast.error("Falha ao carregar equipamentos");
    } else {
      setItems((data as Equipamento[]) ?? []);
    }
    setLoading(false);
  }, [company]);

  useEffect(() => {
    if (company) load();
  }, [company, load]);

  const seedBase = async () => {
    if (!company) return;
    if (!confirm("Popular 50 equipamentos comuns da construção civil?")) return;
    const { error } = await supabase.rpc("seed_equipamentos_base", { _company: company.id });
    if (error) return toast.error(error.message);
    toast.success("Equipamentos base cadastrados");
    load();
  };

  const reset = () => {
    setEdit(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (e: Equipamento) => {
    setEdit(e);
    setForm({
      nome: e.nome,
      descricao: e.descricao ?? "",
      tipo: e.tipo ?? "proprio",
      unidade: e.unidade ?? "H",
      custo_hora: String(e.custo_hora),
      custo_hora_extra: e.custo_hora_extra != null ? String(e.custo_hora_extra) : "",
      ativo: e.ativo,
      observacoes: e.observacoes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!company) return;
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const payload = {
      company_id: company.id,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo || "proprio",
      unidade: form.unidade || "H",
      custo_hora: Number(form.custo_hora) || 0,
      custo_hora_extra: form.custo_hora_extra ? Number(form.custo_hora_extra) : null,
      ativo: form.ativo,
      observacoes: form.observacoes.trim() || null,
    };
    const { error } = edit
      ? await supabase.from("equipamentos").update(payload).eq("id", edit.id)
      : await supabase.from("equipamentos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Equipamento atualizado" : "Equipamento cadastrado");
    setOpen(false);
    reset();
    load();
  };

  const remove = async (e: Equipamento) => {
    if (!confirm(`Excluir equipamento "${e.nome}"?`)) return;
    const { error } = await supabase.from("equipamentos").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Equipamento excluído");
    load();
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

  const filtered = items.filter((i) =>
    !filter.trim() ? true : i.nome.toLowerCase().includes(filter.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / EQUIPAMENTOS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filtered.slice(
    (safePage - 1) * EQUIPAMENTOS_PAGE_SIZE,
    safePage * EQUIPAMENTOS_PAGE_SIZE,
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" /> Obras
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Cadastro de Equipamentos</h1>
            </div>
          </div>
          {canEdit && items.length === 0 && (
            <Button size="sm" variant="outline" onClick={seedBase}>
              <Sparkles className="w-4 h-4 mr-1" /> Popular equipamentos base
            </Button>
          )}
        </div>
      </header>

      <main className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Equipamentos ({filtered.length})</h2>
              <Input
                placeholder="Filtrar por nome..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className="w-64 h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              {canEdit && items.length > 0 && (
                <Button size="sm" variant="outline" onClick={seedBase}>
                  <Sparkles className="w-4 h-4 mr-1" /> Adicionar base padrão
                </Button>
              )}
              {canEdit && (
                <Dialog
                  open={open}
                  onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) reset();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Novo Equipamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {edit ? "Editar Equipamento" : "Novo Equipamento"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={form.nome}
                          onChange={(e) => setForm({ ...form, nome: e.target.value })}
                          placeholder="Ex: Retroescavadeira"
                        />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea
                          rows={2}
                          value={form.descricao}
                          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <Label>Tipo</Label>
                          <Select
                            value={form.tipo}
                            onValueChange={(v) => setForm({ ...form, tipo: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="proprio">Próprio</SelectItem>
                              <SelectItem value="locado">Locado</SelectItem>
                              <SelectItem value="terceirizado">Terceirizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Unidade</Label>
                          <Select
                            value={form.unidade}
                            onValueChange={(v) => setForm({ ...form, unidade: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="H">Hora</SelectItem>
                              <SelectItem value="DIA">Diária</SelectItem>
                              <SelectItem value="MES">Mês</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Ativo</Label>
                          <Select
                            value={form.ativo ? "1" : "0"}
                            onValueChange={(v) => setForm({ ...form, ativo: v === "1" })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Sim</SelectItem>
                              <SelectItem value="0">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>Custo / hora (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.custo_hora}
                            onChange={(e) =>
                              setForm({ ...form, custo_hora: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Custo hora extra (R$) — opcional</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="padrão: 1,5×"
                            value={form.custo_hora_extra}
                            onChange={(e) =>
                              setForm({ ...form, custo_hora_extra: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          rows={2}
                          value={form.observacoes}
                          onChange={(e) =>
                            setForm({ ...form, observacoes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={save}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum equipamento cadastrado.{" "}
              {canEdit && (
                <button className="underline" onClick={seedBase}>
                  Popular com base padrão
                </button>
              )}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Custo / hora</TableHead>
                  <TableHead className="text-right">Hora extra</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.nome}</div>
                      {e.descricao && (
                        <div className="text-xs text-muted-foreground">{e.descricao}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-xs">{e.tipo ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.unidade ?? "H"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(e.custo_hora)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {e.custo_hora_extra != null ? fmtMoney(e.custo_hora_extra) : "1,5×"}
                    </TableCell>
                    <TableCell>
                      {e.ativo ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(e)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > EQUIPAMENTOS_PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
              <span>
                Mostrando {paginatedItems.length} de {filtered.length} equipamentos
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <span className="min-w-20 text-center">
                  Pagina {safePage} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  Proxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
