import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  HardHat,
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/mao-de-obra")({
  component: MaoDeObraPage,
  head: () => ({
    meta: [
      { title: "Apontamento de Mão de Obra" },
      {
        name: "description",
        content:
          "Cadastro de funcionários, equipes, apontamento de horas e indicadores de produtividade.",
      },
    ],
  }),
});

interface Funcao {
  id: string;
  nome: string;
  descricao: string | null;
  custo_hora_base: number;
  encargos_percentual: number;
  ativo: boolean;
}
interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  funcao_id: string | null;
  salario_mensal: number | null;
  custo_hora: number | null;
  ativo: boolean;
}
interface Equipe {
  id: string;
  nome: string;
  descricao: string | null;
  encarregado_id: string | null;
  ativo: boolean;
}
interface Apontamento {
  id: string;
  obra_id: string;
  item_codigo: string | null;
  item_descricao: string | null;
  funcionario_id: string | null;
  funcao_id: string | null;
  data: string;
  horas_normais: number;
  horas_extras: number;
  custo_hora: number;
  custo_total: number;
  quantidade_executada: number | null;
  unidade: string | null;
  observacoes: string | null;
}

function fmtMoney(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MaoDeObraPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = company?.role === "admin" || company?.role === "editor";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [f, fu, e, a, w] = await Promise.all([
        supabase.from("funcoes_mao_obra").select("*").eq("company_id", company.id).order("nome"),
        supabase.from("funcionarios").select("*").eq("company_id", company.id).order("nome"),
        supabase.from("equipes").select("*").eq("company_id", company.id).order("nome"),
        supabase
          .from("apontamentos_mao_obra")
          .select("*")
          .eq("company_id", company.id)
          .order("data", { ascending: false })
          .limit(500),
        supabase.from("company_workspaces").select("workspace").eq("company_id", company.id).maybeSingle(),
      ]);
      if (f.error) throw f.error;
      if (fu.error) throw fu.error;
      if (e.error) throw e.error;
      if (a.error) throw a.error;
      setFuncoes((f.data as Funcao[]) ?? []);
      setFuncionarios((fu.data as Funcionario[]) ?? []);
      setEquipes((e.data as Equipe[]) ?? []);
      setApontamentos((a.data as Apontamento[]) ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (w.data as any)?.workspace;
      const obrasList = (ws?.obras ?? []).map((o: { id: string; nome: string }) => ({
        id: o.id,
        nome: o.nome,
      }));
      setObras(obrasList);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar dados de mão de obra");
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    if (company) load();
  }, [company, load]);

  const seedBase = async () => {
    if (!company) return;
    if (!confirm("Popular 15 funções base (pedreiro, servente, eletricista, etc.)?")) return;
    const { error } = await supabase.rpc("seed_funcoes_base", { _company: company.id });
    if (error) return toast.error(error.message);
    toast.success("Funções base populadas");
    load();
  };

  // Indicadores de produtividade por item
  const produtividade = useMemo(() => {
    const map = new Map<
      string,
      {
        obra_id: string;
        item_codigo: string;
        item_descricao: string;
        horas: number;
        custo: number;
        qtd: number;
        unidade: string;
      }
    >();
    for (const ap of apontamentos) {
      const key = `${ap.obra_id}|${ap.item_codigo ?? "—"}`;
      const cur = map.get(key) ?? {
        obra_id: ap.obra_id,
        item_codigo: ap.item_codigo ?? "—",
        item_descricao: ap.item_descricao ?? "—",
        horas: 0,
        custo: 0,
        qtd: 0,
        unidade: ap.unidade ?? "",
      };
      cur.horas += Number(ap.horas_normais) + Number(ap.horas_extras);
      cur.custo += Number(ap.custo_total);
      cur.qtd += Number(ap.quantidade_executada ?? 0);
      if (ap.unidade) cur.unidade = ap.unidade;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.horas - a.horas);
  }, [apontamentos]);

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
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" /> Obras
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Mão de Obra & Produtividade</h1>
            </div>
          </div>
          {canEdit && funcoes.length === 0 && (
            <Button size="sm" variant="outline" onClick={seedBase}>
              <Sparkles className="w-4 h-4 mr-1" /> Popular funções base
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs defaultValue="apontamentos">
          <TabsList>
            <TabsTrigger value="apontamentos">
              <Clock className="w-4 h-4 mr-1" /> Apontamentos
            </TabsTrigger>
            <TabsTrigger value="produtividade">
              <TrendingUp className="w-4 h-4 mr-1" /> Produtividade
            </TabsTrigger>
            <TabsTrigger value="funcionarios">
              <Users className="w-4 h-4 mr-1" /> Funcionários
            </TabsTrigger>
            <TabsTrigger value="equipes">Equipes</TabsTrigger>
            <TabsTrigger value="funcoes">Funções</TabsTrigger>
          </TabsList>

          <TabsContent value="apontamentos" className="mt-4">
            <ApontamentosTab
              apontamentos={apontamentos}
              funcionarios={funcionarios}
              funcoes={funcoes}
              obras={obras}
              companyId={company.id}
              canEdit={canEdit}
              onReload={load}
            />
          </TabsContent>

          <TabsContent value="produtividade" className="mt-4">
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Produtividade por Item / Atividade</h2>
              {produtividade.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum apontamento registrado ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obra</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Qtd Exec.</TableHead>
                      <TableHead className="text-right">h/un</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">R$/un</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtividade.map((p, idx) => {
                      const obraNome =
                        obras.find((o) => o.id === p.obra_id)?.nome ?? p.obra_id;
                      const hPorUn = p.qtd > 0 ? p.horas / p.qtd : 0;
                      const rPorUn = p.qtd > 0 ? p.custo / p.qtd : 0;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{obraNome}</TableCell>
                          <TableCell className="text-xs font-mono">{p.item_codigo}</TableCell>
                          <TableCell className="text-xs">{p.item_descricao}</TableCell>
                          <TableCell className="text-right">{p.horas.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {p.qtd.toFixed(2)} {p.unidade}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.qtd > 0 ? hPorUn.toFixed(3) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{fmtMoney(p.custo)}</TableCell>
                          <TableCell className="text-right">
                            {p.qtd > 0 ? fmtMoney(rPorUn) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="funcionarios" className="mt-4">
            <FuncionariosTab
              funcionarios={funcionarios}
              funcoes={funcoes}
              companyId={company.id}
              canEdit={canEdit}
              onReload={load}
            />
          </TabsContent>

          <TabsContent value="equipes" className="mt-4">
            <EquipesTab
              equipes={equipes}
              funcionarios={funcionarios}
              companyId={company.id}
              canEdit={canEdit}
              onReload={load}
            />
          </TabsContent>

          <TabsContent value="funcoes" className="mt-4">
            <FuncoesTab
              funcoes={funcoes}
              companyId={company.id}
              canEdit={canEdit}
              onReload={load}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============================================================
// Tab: Funções
// ============================================================
function FuncoesTab({
  funcoes,
  companyId,
  canEdit,
  onReload,
}: {
  funcoes: Funcao[];
  companyId: string;
  canEdit: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Funcao | null>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    custo_hora_base: "0",
    encargos_percentual: "80",
  });

  const reset = () => {
    setEdit(null);
    setForm({ nome: "", descricao: "", custo_hora_base: "0", encargos_percentual: "80" });
  };

  const openEdit = (f: Funcao) => {
    setEdit(f);
    setForm({
      nome: f.nome,
      descricao: f.descricao ?? "",
      custo_hora_base: String(f.custo_hora_base),
      encargos_percentual: String(f.encargos_percentual),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const payload = {
      company_id: companyId,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      custo_hora_base: Number(form.custo_hora_base) || 0,
      encargos_percentual: Number(form.encargos_percentual) || 0,
    };
    const { error } = edit
      ? await supabase.from("funcoes_mao_obra").update(payload).eq("id", edit.id)
      : await supabase.from("funcoes_mao_obra").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Função atualizada" : "Função criada");
    setOpen(false);
    reset();
    onReload();
  };

  const remove = async (f: Funcao) => {
    if (!confirm(`Excluir função "${f.nome}"?`)) return;
    const { error } = await supabase.from("funcoes_mao_obra").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Função excluída");
    onReload();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Funções de Mão de Obra</h2>
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
                <Plus className="w-4 h-4 mr-1" /> Nova Função
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit ? "Editar Função" : "Nova Função"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Custo/hora base (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.custo_hora_base}
                      onChange={(e) =>
                        setForm({ ...form, custo_hora_base: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Encargos (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.encargos_percentual}
                      onChange={(e) =>
                        setForm({ ...form, encargos_percentual: e.target.value })
                      }
                    />
                  </div>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-right">Custo/h Base</TableHead>
            <TableHead className="text-right">Encargos</TableHead>
            <TableHead className="text-right">Custo/h c/ Encargos</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {funcoes.map((f) => {
            const cTotal = f.custo_hora_base * (1 + f.encargos_percentual / 100);
            return (
              <TableRow key={f.id}>
                <TableCell>{f.nome}</TableCell>
                <TableCell className="text-right">{fmtMoney(f.custo_hora_base)}</TableCell>
                <TableCell className="text-right">{f.encargos_percentual}%</TableCell>
                <TableCell className="text-right font-medium">{fmtMoney(cTotal)}</TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(f)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {funcoes.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                Nenhuma função cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================
// Tab: Funcionários
// ============================================================
function FuncionariosTab({
  funcionarios,
  funcoes,
  companyId,
  canEdit,
  onReload,
}: {
  funcionarios: Funcionario[];
  funcoes: Funcao[];
  companyId: string;
  canEdit: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Funcionario | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    matricula: "",
    funcao_id: "",
    salario_mensal: "0",
    custo_hora: "0",
  });

  const reset = () => {
    setEdit(null);
    setForm({ nome: "", cpf: "", matricula: "", funcao_id: "", salario_mensal: "0", custo_hora: "0" });
  };

  const openEdit = (f: Funcionario) => {
    setEdit(f);
    setForm({
      nome: f.nome,
      cpf: f.cpf ?? "",
      matricula: f.matricula ?? "",
      funcao_id: f.funcao_id ?? "",
      salario_mensal: String(f.salario_mensal ?? 0),
      custo_hora: String(f.custo_hora ?? 0),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const payload = {
      company_id: companyId,
      nome: form.nome.trim(),
      cpf: form.cpf.trim() || null,
      matricula: form.matricula.trim() || null,
      funcao_id: form.funcao_id || null,
      salario_mensal: Number(form.salario_mensal) || 0,
      custo_hora: Number(form.custo_hora) || 0,
    };
    const { error } = edit
      ? await supabase.from("funcionarios").update(payload).eq("id", edit.id)
      : await supabase.from("funcionarios").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Funcionário atualizado" : "Funcionário criado");
    setOpen(false);
    reset();
    onReload();
  };

  const remove = async (f: Funcionario) => {
    if (!confirm(`Excluir "${f.nome}"?`)) return;
    const { error } = await supabase.from("funcionarios").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Funcionário excluído");
    onReload();
  };

  const funcaoNome = (id: string | null) => funcoes.find((f) => f.id === id)?.nome ?? "—";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Funcionários</h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo Funcionário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                  </div>
                  <div>
                    <Label>Matrícula</Label>
                    <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Função</Label>
                  <Select
                    value={form.funcao_id}
                    onValueChange={(v) => {
                      const f = funcoes.find((x) => x.id === v);
                      setForm({
                        ...form,
                        funcao_id: v,
                        custo_hora:
                          Number(form.custo_hora) > 0
                            ? form.custo_hora
                            : f
                              ? String((f.custo_hora_base * (1 + f.encargos_percentual / 100)).toFixed(2))
                              : form.custo_hora,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funcoes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Salário mensal (R$)</Label>
                    <Input type="number" step="0.01" value={form.salario_mensal}
                      onChange={(e) => setForm({ ...form, salario_mensal: e.target.value })} />
                  </div>
                  <div>
                    <Label>Custo/hora (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_hora}
                      onChange={(e) => setForm({ ...form, custo_hora: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead>Função</TableHead>
            <TableHead className="text-right">Custo/h</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {funcionarios.map((f) => (
            <TableRow key={f.id}>
              <TableCell>{f.nome}</TableCell>
              <TableCell className="text-xs">{f.matricula ?? "—"}</TableCell>
              <TableCell className="text-xs">{funcaoNome(f.funcao_id)}</TableCell>
              <TableCell className="text-right">{fmtMoney(f.custo_hora ?? 0)}</TableCell>
              <TableCell>
                {f.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
              </TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {funcionarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                Nenhum funcionário cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================
// Tab: Equipes
// ============================================================
function EquipesTab({
  equipes,
  funcionarios,
  companyId,
  canEdit,
  onReload,
}: {
  equipes: Equipe[];
  funcionarios: Funcionario[];
  companyId: string;
  canEdit: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", encarregado_id: "" });

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("equipes").insert({
      company_id: companyId,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      encarregado_id: form.encarregado_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Equipe criada");
    setForm({ nome: "", descricao: "", encarregado_id: "" });
    setOpen(false);
    onReload();
  };

  const remove = async (e: Equipe) => {
    if (!confirm(`Excluir equipe "${e.nome}"?`)) return;
    const { error } = await supabase.from("equipes").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Equipe excluída");
    onReload();
  };

  const encNome = (id: string | null) => funcionarios.find((f) => f.id === id)?.nome ?? "—";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Equipes</h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Nova Equipe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Equipe</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div>
                  <Label>Encarregado</Label>
                  <Select value={form.encarregado_id} onValueChange={(v) => setForm({ ...form, encarregado_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Encarregado</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipes.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.nome}</TableCell>
              <TableCell className="text-xs">{encNome(e.encarregado_id)}</TableCell>
              <TableCell className="text-xs">{e.descricao ?? "—"}</TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <Button size="icon" variant="ghost" onClick={() => remove(e)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {equipes.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                Nenhuma equipe cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================
// Tab: Apontamentos
// ============================================================
function ApontamentosTab({
  apontamentos,
  funcionarios,
  funcoes,
  obras,
  companyId,
  canEdit,
  onReload,
}: {
  apontamentos: Apontamento[];
  funcionarios: Funcionario[];
  funcoes: Funcao[];
  obras: { id: string; nome: string }[];
  companyId: string;
  canEdit: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    obra_id: "",
    item_codigo: "",
    item_descricao: "",
    funcionario_id: "",
    funcao_id: "",
    data: today,
    horas_normais: "8",
    horas_extras: "0",
    custo_hora: "0",
    quantidade_executada: "0",
    unidade: "",
    observacoes: "",
  });

  const reset = () =>
    setForm({
      obra_id: "",
      item_codigo: "",
      item_descricao: "",
      funcionario_id: "",
      funcao_id: "",
      data: today,
      horas_normais: "8",
      horas_extras: "0",
      custo_hora: "0",
      quantidade_executada: "0",
      unidade: "",
      observacoes: "",
    });

  const onFuncionarioChange = (id: string) => {
    const f = funcionarios.find((x) => x.id === id);
    const fnc = funcoes.find((x) => x.id === f?.funcao_id);
    setForm({
      ...form,
      funcionario_id: id,
      funcao_id: f?.funcao_id ?? form.funcao_id,
      custo_hora:
        f && Number(f.custo_hora) > 0
          ? String(f.custo_hora)
          : fnc
            ? String((fnc.custo_hora_base * (1 + fnc.encargos_percentual / 100)).toFixed(2))
            : form.custo_hora,
    });
  };

  const save = async () => {
    if (!form.obra_id) return toast.error("Selecione a obra");
    const hn = Number(form.horas_normais) || 0;
    const he = Number(form.horas_extras) || 0;
    const ch = Number(form.custo_hora) || 0;
    const total = (hn + he * 1.5) * ch;
    const { error } = await supabase.from("apontamentos_mao_obra").insert({
      company_id: companyId,
      obra_id: form.obra_id,
      item_codigo: form.item_codigo.trim() || null,
      item_descricao: form.item_descricao.trim() || null,
      funcionario_id: form.funcionario_id || null,
      funcao_id: form.funcao_id || null,
      data: form.data,
      horas_normais: hn,
      horas_extras: he,
      custo_hora: ch,
      custo_total: total,
      quantidade_executada: Number(form.quantidade_executada) || 0,
      unidade: form.unidade.trim() || null,
      observacoes: form.observacoes.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Apontamento registrado");
    reset();
    setOpen(false);
    onReload();
  };

  const remove = async (a: Apontamento) => {
    if (!confirm("Excluir este apontamento?")) return;
    const { error } = await supabase.from("apontamentos_mao_obra").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    onReload();
  };

  const funcionarioNome = (id: string | null) =>
    funcionarios.find((f) => f.id === id)?.nome ?? "—";
  const obraNome = (id: string) => obras.find((o) => o.id === id)?.nome ?? id;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Apontamentos de Horas</h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo Apontamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo Apontamento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Obra *</Label>
                    <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {obras.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Item / Código</Label>
                    <Input value={form.item_codigo} onChange={(e) => setForm({ ...form, item_codigo: e.target.value })} />
                  </div>
                  <div>
                    <Label>Atividade / Descrição</Label>
                    <Input value={form.item_descricao} onChange={(e) => setForm({ ...form, item_descricao: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Funcionário</Label>
                    <Select value={form.funcionario_id} onValueChange={onFuncionarioChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {funcionarios.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Função</Label>
                    <Select value={form.funcao_id} onValueChange={(v) => setForm({ ...form, funcao_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {funcoes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Horas normais</Label>
                    <Input type="number" step="0.25" value={form.horas_normais}
                      onChange={(e) => setForm({ ...form, horas_normais: e.target.value })} />
                  </div>
                  <div>
                    <Label>Horas extras</Label>
                    <Input type="number" step="0.25" value={form.horas_extras}
                      onChange={(e) => setForm({ ...form, horas_extras: e.target.value })} />
                  </div>
                  <div>
                    <Label>Custo/hora (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_hora}
                      onChange={(e) => setForm({ ...form, custo_hora: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade executada</Label>
                    <Input type="number" step="0.01" value={form.quantidade_executada}
                      onChange={(e) => setForm({ ...form, quantidade_executada: e.target.value })} />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Custo estimado:{" "}
                  <strong>
                    {fmtMoney(
                      ((Number(form.horas_normais) || 0) +
                        (Number(form.horas_extras) || 0) * 1.5) *
                        (Number(form.custo_hora) || 0),
                    )}
                  </strong>{" "}
                  (h.extra com adicional 50%)
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Registrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Obra</TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead>Atividade</TableHead>
            <TableHead className="text-right">HN</TableHead>
            <TableHead className="text-right">HE</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apontamentos.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-xs">{a.data}</TableCell>
              <TableCell className="text-xs">{obraNome(a.obra_id)}</TableCell>
              <TableCell className="text-xs">{funcionarioNome(a.funcionario_id)}</TableCell>
              <TableCell className="text-xs">
                {a.item_codigo ? `${a.item_codigo} — ` : ""}{a.item_descricao ?? "—"}
              </TableCell>
              <TableCell className="text-right">{Number(a.horas_normais).toFixed(2)}</TableCell>
              <TableCell className="text-right">{Number(a.horas_extras).toFixed(2)}</TableCell>
              <TableCell className="text-right">
                {a.quantidade_executada ? `${Number(a.quantidade_executada).toFixed(2)} ${a.unidade ?? ""}` : "—"}
              </TableCell>
              <TableCell className="text-right">{fmtMoney(a.custo_total)}</TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <Button size="icon" variant="ghost" onClick={() => remove(a)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {apontamentos.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                Nenhum apontamento registrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
