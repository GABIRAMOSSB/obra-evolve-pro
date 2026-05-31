import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Package,
  Plus,
  Sparkles,
  Trash2,
  Tag,
  Ruler,
  Search,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_app/insumos")({
  component: InsumosPage,
  head: () => ({
    meta: [
      { title: "Cadastro Mestre de Insumos" },
      {
        name: "description",
        content: "Cadastro corporativo de insumos, unidades e categorias.",
      },
    ],
  }),
});

interface Unidade {
  id: string;
  sigla: string;
  descricao: string;
  unidade_base_id: string | null;
  fator_conversao: number;
}
interface Categoria {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem: number;
}
interface Insumo {
  id: string;
  codigo: string | null;
  descricao: string;
  categoria_id: string | null;
  unidade_id: string | null;
  ncm: string | null;
  observacoes: string | null;
  ativo: boolean;
}
interface Alias {
  id: string;
  insumo_id: string;
  descricao_alternativa: string;
  fornecedor: string | null;
  cnpj_fornecedor: string | null;
  origem: string;
}

function InsumosPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const canEdit = company?.role === "admin" || company?.role === "editor";
  const isAdmin = company?.role === "admin";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [u, c, i, a] = await Promise.all([
        supabase.from("unidades_medida").select("*").eq("company_id", company.id).order("sigla"),
        supabase.from("insumo_categorias").select("*").eq("company_id", company.id).order("ordem"),
        supabase.from("insumos_mestre").select("*").eq("company_id", company.id).order("descricao"),
        supabase.from("insumo_aliases").select("*").eq("company_id", company.id).order("descricao_alternativa"),
      ]);
      if (u.error) throw u.error;
      if (c.error) throw c.error;
      if (i.error) throw i.error;
      if (a.error) throw a.error;
      setUnidades((u.data as Unidade[]) ?? []);
      setCategorias((c.data as Categoria[]) ?? []);
      setInsumos((i.data as Insumo[]) ?? []);
      setAliases((a.data as Alias[]) ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar cadastros");
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    if (company) load();
  }, [company, load]);

  const seedBase = async () => {
    if (!company) return;
    if (!confirm("Popular base inicial de unidades, categorias e ~45 insumos populares?")) return;
    const { error } = await supabase.rpc("seed_insumos_base", { _company: company.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Base inicial populada");
    load();
  };

  const insumosFiltrados = useMemo(() => {
    const s = search.trim().toLowerCase();
    return insumos.filter((i) => {
      if (filterCat !== "all" && i.categoria_id !== filterCat) return false;
      if (!s) return true;
      return (
        i.descricao.toLowerCase().includes(s) ||
        (i.codigo ?? "").toLowerCase().includes(s) ||
        (i.ncm ?? "").toLowerCase().includes(s)
      );
    });
  }, [insumos, search, filterCat]);

  const catName = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "—";
  const uniSigla = (id: string | null) => unidades.find((u) => u.id === id)?.sigla ?? "—";

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
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" /> Obras
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h1 className="text-base font-semibold">Cadastro Mestre de Insumos</h1>
              <Badge variant="outline">{company.name}</Badge>
            </div>
          </div>
          {canEdit && insumos.length === 0 && (
            <Button onClick={seedBase} size="sm">
              <Sparkles className="w-4 h-4 mr-1" /> Popular base inicial
            </Button>
          )}
        </div>
      </header>

      <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="insumos">
          <TabsList>
            <TabsTrigger value="insumos">
              <Package className="w-4 h-4 mr-1" /> Insumos ({insumos.length})
            </TabsTrigger>
            <TabsTrigger value="categorias">
              <Tag className="w-4 h-4 mr-1" /> Categorias ({categorias.length})
            </TabsTrigger>
            <TabsTrigger value="unidades">
              <Ruler className="w-4 h-4 mr-1" /> Unidades ({unidades.length})
            </TabsTrigger>
            <TabsTrigger value="aliases">
              Aliases ({aliases.length})
            </TabsTrigger>
          </TabsList>

          {/* INSUMOS */}
          <TabsContent value="insumos" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-2 items-center flex-1 w-full sm:flex-1 sm:min-w-[18rem]">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição, código ou NCM..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-md"
                  />
                  <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canEdit && (
                  <InsumoDialog
                    companyId={company.id}
                    categorias={categorias}
                    unidades={unidades}
                    onSaved={load}
                  />
                )}
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[180px]">Categoria</TableHead>
                      <TableHead className="w-[80px]">Un.</TableHead>
                      <TableHead className="w-[120px]">NCM</TableHead>
                      <TableHead className="w-[110px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insumosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum insumo cadastrado.{" "}
                          {canEdit && "Clique em 'Popular base inicial' ou em '+ Novo insumo'."}
                        </TableCell>
                      </TableRow>
                    )}
                    {insumosFiltrados.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.codigo ?? "—"}</TableCell>
                        <TableCell className="font-medium">{i.descricao}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{catName(i.categoria_id)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{uniSigla(i.unidade_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{i.ncm ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {canEdit && (
                            <InsumoDialog
                              companyId={company.id}
                              categorias={categorias}
                              unidades={unidades}
                              insumo={i}
                              onSaved={load}
                              trigger={
                                <Button variant="ghost" size="icon">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              }
                            />
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!confirm(`Excluir "${i.descricao}"?`)) return;
                                const { error } = await supabase
                                  .from("insumos_mestre")
                                  .delete()
                                  .eq("id", i.id);
                                if (error) toast.error(error.message);
                                else {
                                  toast.success("Excluído");
                                  load();
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* CATEGORIAS */}
          <TabsContent value="categorias" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex justify-end">
                {canEdit && (
                  <SimpleNameDialog
                    title="Nova categoria"
                    label="Nome da categoria"
                    onSave={async (nome) => {
                      const { error } = await supabase
                        .from("insumo_categorias")
                        .insert({ company_id: company.id, nome });
                      if (error) {
                        toast.error(error.message);
                        return false;
                      }
                      toast.success("Categoria criada");
                      load();
                      return true;
                    }}
                    trigger={
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Nova categoria
                      </Button>
                    }
                  />
                )}
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[140px]">Insumos vinculados</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.map((c) => {
                      const count = insumos.filter((i) => i.categoria_id === c.id).length;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (count > 0) {
                                    toast.error("Categoria possui insumos vinculados");
                                    return;
                                  }
                                  if (!confirm(`Excluir categoria "${c.nome}"?`)) return;
                                  const { error } = await supabase
                                    .from("insumo_categorias")
                                    .delete()
                                    .eq("id", c.id);
                                  if (error) toast.error(error.message);
                                  else {
                                    toast.success("Excluída");
                                    load();
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* UNIDADES */}
          <TabsContent value="unidades" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex justify-end">
                {canEdit && (
                  <UnidadeDialog companyId={company.id} unidades={unidades} onSaved={load} />
                )}
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Sigla</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[140px]">Unidade base</TableHead>
                      <TableHead className="w-[140px]">Fator conv.</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unidades.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono font-semibold">{u.sigla}</TableCell>
                        <TableCell>{u.descricao}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {u.unidade_base_id
                            ? unidades.find((x) => x.id === u.unidade_base_id)?.sigla ?? "—"
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.fator_conversao}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!confirm(`Excluir unidade "${u.sigla}"?`)) return;
                                const { error } = await supabase
                                  .from("unidades_medida")
                                  .delete()
                                  .eq("id", u.id);
                                if (error) toast.error(error.message);
                                else {
                                  toast.success("Excluída");
                                  load();
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ALIASES */}
          <TabsContent value="aliases" className="mt-4">
            <Card className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Aliases são descrições alternativas (de XMLs e fornecedores) vinculadas a um insumo
                do mestre. Eles serão preenchidos automaticamente quando o módulo de importação de
                XML estiver ativo. Você também pode cadastrar manualmente.
              </p>
              <div className="flex justify-end">
                {canEdit && (
                  <AliasDialog companyId={company.id} insumos={insumos} onSaved={load} />
                )}
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição alternativa</TableHead>
                      <TableHead>Insumo mestre</TableHead>
                      <TableHead className="w-[180px]">Fornecedor</TableHead>
                      <TableHead className="w-[100px]">Origem</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aliases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum alias cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {aliases.map((a) => {
                      const i = insumos.find((x) => x.id === a.insumo_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{a.descricao_alternativa}</TableCell>
                          <TableCell className="text-xs">{i?.descricao ?? "—"}</TableCell>
                          <TableCell className="text-xs">{a.fornecedor ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.origem}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (!confirm("Excluir alias?")) return;
                                  const { error } = await supabase
                                    .from("insumo_aliases")
                                    .delete()
                                    .eq("id", a.id);
                                  if (error) toast.error(error.message);
                                  else {
                                    toast.success("Excluído");
                                    load();
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Dialogs ----------

function InsumoDialog({
  companyId,
  categorias,
  unidades,
  insumo,
  onSaved,
  trigger,
}: {
  companyId: string;
  categorias: Categoria[];
  unidades: Unidade[];
  insumo?: Insumo;
  onSaved: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState(insumo?.codigo ?? "");
  const [descricao, setDescricao] = useState(insumo?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<string>(insumo?.categoria_id ?? "");
  const [unidadeId, setUnidadeId] = useState<string>(insumo?.unidade_id ?? "");
  const [ncm, setNcm] = useState(insumo?.ncm ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !insumo) {
      setCodigo("");
      setDescricao("");
      setCategoriaId("");
      setUnidadeId("");
      setNcm("");
    }
  }, [open, insumo]);

  const save = async () => {
    if (!descricao.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      codigo: codigo.trim() || null,
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      unidade_id: unidadeId || null,
      ncm: ncm.trim() || null,
    };
    const q = insumo
      ? supabase.from("insumos_mestre").update(payload).eq("id", insumo.id)
      : supabase.from("insumos_mestre").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(insumo ? "Atualizado" : "Cadastrado");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo insumo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{insumo ? "Editar insumo" : "Novo insumo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Código</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>NCM</Label>
              <Input value={ncm} onChange={(e) => setNcm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição padronizada *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: CIMENTO CP II - SACO 50 KG"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.sigla} — {u.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnidadeDialog({
  companyId,
  unidades,
  onSaved,
}: {
  companyId: string;
  unidades: Unidade[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sigla, setSigla] = useState("");
  const [descricao, setDescricao] = useState("");
  const [baseId, setBaseId] = useState<string>("");
  const [fator, setFator] = useState("1");

  const save = async () => {
    if (!sigla.trim() || !descricao.trim()) {
      toast.error("Sigla e descrição obrigatórias");
      return;
    }
    const { error } = await supabase.from("unidades_medida").insert({
      company_id: companyId,
      sigla: sigla.trim().toUpperCase(),
      descricao: descricao.trim(),
      unidade_base_id: baseId || null,
      fator_conversao: Number(fator) || 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unidade criada");
    setOpen(false);
    setSigla("");
    setDescricao("");
    setBaseId("");
    setFator("1");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova unidade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova unidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Sigla *</Label>
              <Input value={sigla} onChange={(e) => setSigla(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade base (opcional)</Label>
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fator conversão</Label>
              <Input type="number" value={fator} onChange={(e) => setFator(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AliasDialog({
  companyId,
  insumos,
  onSaved,
}: {
  companyId: string;
  insumos: Insumo[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [insumoId, setInsumoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [cnpj, setCnpj] = useState("");

  const save = async () => {
    if (!insumoId || !descricao.trim()) {
      toast.error("Insumo e descrição obrigatórios");
      return;
    }
    const { error } = await supabase.from("insumo_aliases").insert({
      company_id: companyId,
      insumo_id: insumoId,
      descricao_alternativa: descricao.trim(),
      fornecedor: fornecedor.trim() || null,
      cnpj_fornecedor: cnpj.trim() || null,
      origem: "manual",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Alias criado");
    setOpen(false);
    setInsumoId("");
    setDescricao("");
    setFornecedor("");
    setCnpj("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo alias
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo alias</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Insumo mestre *</Label>
            <Select value={insumoId} onValueChange={setInsumoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {insumos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição alternativa *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Como aparece na NF do fornecedor"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimpleNameDialog({
  title,
  label,
  trigger,
  onSave,
}: {
  title: string;
  label: string;
  trigger: React.ReactNode;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>{label}</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!value.trim()) return;
              const ok = await onSave(value.trim());
              if (ok) {
                setOpen(false);
                setValue("");
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
