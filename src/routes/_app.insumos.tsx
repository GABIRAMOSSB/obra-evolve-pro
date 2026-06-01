import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/_app/insumos")({
  component: InsumosPage,
  head: () => ({
    meta: [
      { title: "Cadastro Mestre de Insumos" },
      {
        name: "description",
        content: "Cadastro corporativo de insumos, unidades e categorias, com importação SINAPI.",
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
interface InsumoRow {
  id: string;
  codigo: string | null;
  sinapi_codigo: string | null;
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  unidade_id: string | null;
  unidade_sigla: string | null;
  ncm: string | null;
  imagem_url: string | null;
  versao_sinapi: string | null;
  normas_tecnicas: string | null;
  especificacao_tecnica: string | null;
  ativo: boolean;
  updated_at: string | null;
  total_count: number;
}

const PAGE_SIZES = [20, 50, 100];

function InsumosPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rows, setRows] = useState<InsumoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aliasesCount, setAliasesCount] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterUni, setFilterUni] = useState<string>("all");
  const [filterNcm, setFilterNcm] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [preview, setPreview] = useState<InsumoRow | null>(null);

  const canEdit = company?.role === "admin" || company?.role === "editor";
  const isAdmin = company?.role === "admin";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // load filter sources once per company
  const loadRefs = useCallback(async () => {
    if (!company) return;
    const [u, c, ac] = await Promise.all([
      supabase.from("unidades_medida").select("*").eq("company_id", company.id).order("sigla"),
      supabase.from("insumo_categorias").select("*").eq("company_id", company.id).order("nome"),
      supabase.from("insumo_aliases").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    ]);
    if (!u.error) setUnidades((u.data as Unidade[]) ?? []);
    if (!c.error) setCategorias((c.data as Categoria[]) ?? []);
    setAliasesCount(ac.count ?? 0);
  }, [company]);

  // load page via RPC
  const loadPage = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("search_insumos", {
        _company: company.id,
        _q: debouncedSearch || null,
        _categoria: filterCat === "all" ? null : filterCat,
        _unidade: filterUni === "all" ? null : filterUni,
        _ncm: filterNcm.trim() || null,
        _page: page,
        _page_size: pageSize,
      });
      if (error) throw error;
      const list = (data as InsumoRow[]) ?? [];
      setRows(list);
      setTotal(list[0]?.total_count ? Number(list[0].total_count) : 0);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Falha ao buscar insumos");
    } finally {
      setLoading(false);
    }
  }, [company, debouncedSearch, filterCat, filterUni, filterNcm, page, pageSize]);

  useEffect(() => {
    if (company) loadRefs();
  }, [company, loadRefs]);

  useEffect(() => {
    if (company) loadPage();
  }, [company, loadPage]);

  const reloadAll = useCallback(() => {
    loadRefs();
    loadPage();
  }, [loadRefs, loadPage]);

  const seedBase = async () => {
    if (!company) return;
    if (!confirm("Popular base inicial de unidades, categorias e ~45 insumos populares?")) return;
    const { error } = await supabase.rpc("seed_insumos_base", { _company: company.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Base inicial populada");
    reloadAll();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (authLoading || companyLoading) {
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
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild size="sm" variant="default">
                <Link to="/insumos/importar">
                  <Upload className="w-4 h-4 mr-1" /> Importar SINAPI
                </Link>
              </Button>
            )}
            {canEdit && total === 0 && !debouncedSearch && (
              <Button onClick={seedBase} size="sm" variant="outline">
                <Sparkles className="w-4 h-4 mr-1" /> Popular base inicial
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="insumos">
          <TabsList>
            <TabsTrigger value="insumos">
              <Package className="w-4 h-4 mr-1" /> Insumos
            </TabsTrigger>
            <TabsTrigger value="categorias">
              <Tag className="w-4 h-4 mr-1" /> Categorias ({categorias.length})
            </TabsTrigger>
            <TabsTrigger value="unidades">
              <Ruler className="w-4 h-4 mr-1" /> Unidades ({unidades.length})
            </TabsTrigger>
            <TabsTrigger value="aliases">
              Aliases ({aliasesCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insumos" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <Label className="text-xs">Buscar (descrição, código SINAPI ou NCM)</Label>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite para buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={filterUni} onValueChange={(v) => { setFilterUni(v); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.sigla}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">NCM</Label>
                  <Input
                    value={filterNcm}
                    onChange={(e) => setFilterNcm(e.target.value)}
                    onBlur={() => setPage(1)}
                    placeholder="Filtrar por NCM"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {loading ? "Carregando..." : `${total.toLocaleString("pt-BR")} insumo(s) encontrados`}
                </span>
                {canEdit && (
                  <InsumoDialog
                    companyId={company.id}
                    categorias={categorias}
                    unidades={unidades}
                    onSaved={reloadAll}
                  />
                )}
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[64px]">Img</TableHead>
                      <TableHead className="w-[120px]">SINAPI</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[180px]">Categoria</TableHead>
                      <TableHead className="w-[80px]">Un.</TableHead>
                      <TableHead className="w-[120px]">NCM</TableHead>
                      <TableHead className="w-[150px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum insumo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.imagem_url ? (
                            <button
                              onClick={() => setPreview(i)}
                              className="block w-10 h-10 rounded border overflow-hidden bg-muted"
                            >
                              <img src={i.imagem_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded border bg-muted/40 flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{i.sinapi_codigo ?? i.codigo ?? "—"}</TableCell>
                        <TableCell className="font-medium">
                          <button className="text-left hover:underline" onClick={() => setPreview(i)}>
                            {i.descricao}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{i.categoria_nome ?? "—"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{i.unidade_sigla ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{i.ncm ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setPreview(i)} title="Ver detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <InsumoDialog
                              companyId={company.id}
                              categorias={categorias}
                              unidades={unidades}
                              insumo={i}
                              onSaved={reloadAll}
                              trigger={
                                <Button variant="ghost" size="icon" title="Editar">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              }
                            />
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              onClick={async () => {
                                if (!confirm(`Excluir "${i.descricao}"?`)) return;
                                const { error } = await supabase
                                  .from("insumos_mestre")
                                  .delete()
                                  .eq("id", i.id);
                                if (error) toast.error(error.message);
                                else {
                                  toast.success("Excluído");
                                  reloadAll();
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

              {/* paginação */}
              <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Por página:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

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
                      if (error) { toast.error(error.message); return false; }
                      toast.success("Categoria criada");
                      loadRefs();
                      return true;
                    }}
                    trigger={<Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova categoria</Button>}
                  />
                )}
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!confirm(`Excluir categoria "${c.nome}"? Insumos vinculados ficarão sem categoria.`)) return;
                                const { error } = await supabase.from("insumo_categorias").delete().eq("id", c.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Excluída"); reloadAll(); }
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

          <TabsContent value="unidades" className="mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex justify-end">
                {canEdit && <UnidadeDialog companyId={company.id} unidades={unidades} onSaved={loadRefs} />}
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Sigla</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unidades.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono font-semibold">{u.sigla}</TableCell>
                        <TableCell>{u.descricao}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!confirm(`Excluir unidade "${u.sigla}"?`)) return;
                                const { error } = await supabase.from("unidades_medida").delete().eq("id", u.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Excluída"); loadRefs(); }
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

          <TabsContent value="aliases" className="mt-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Aliases são descrições alternativas vinculadas a um insumo do mestre (vindas de XMLs e fornecedores).
                Use o cadastro avançado de aliases em telas de importação de NF-e. ({aliasesCount} alias(es) cadastrado(s))
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog de visualização detalhada */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.descricao}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                {preview.imagem_url ? (
                  <img src={preview.imagem_url} alt={preview.descricao} className="w-full rounded border" />
                ) : (
                  <div className="aspect-square rounded border bg-muted/40 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="md:col-span-2 space-y-2 text-sm">
                <Field label="Código SINAPI" value={preview.sinapi_codigo} mono />
                <Field label="Código interno" value={preview.codigo} mono />
                <Field label="Categoria" value={preview.categoria_nome} />
                <Field label="Unidade" value={preview.unidade_sigla} mono />
                <Field label="NCM" value={preview.ncm} mono />
                <Field label="Versão SINAPI" value={preview.versao_sinapi} />
                <Field label="Especificação técnica" value={preview.especificacao_tecnica} multi />
                <Field label="Normas técnicas" value={preview.normas_tecnicas} multi />
                <Field
                  label="Última atualização"
                  value={preview.updated_at ? new Date(preview.updated_at).toLocaleString("pt-BR") : null}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  multi,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multi?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono text-xs" : ""} ${multi ? "whitespace-pre-wrap" : ""}`}>
        {value && String(value).trim() ? value : <span className="text-muted-foreground">—</span>}
      </div>
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
  insumo?: InsumoRow;
  onSaved: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState(insumo?.codigo ?? "");
  const [sinapi, setSinapi] = useState(insumo?.sinapi_codigo ?? "");
  const [descricao, setDescricao] = useState(insumo?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState<string>(insumo?.categoria_id ?? "");
  const [unidadeId, setUnidadeId] = useState<string>(insumo?.unidade_id ?? "");
  const [ncm, setNcm] = useState(insumo?.ncm ?? "");
  const [especificacao, setEspecificacao] = useState(insumo?.especificacao_tecnica ?? "");
  const [normas, setNormas] = useState(insumo?.normas_tecnicas ?? "");
  const [imagemUrl, setImagemUrl] = useState(insumo?.imagem_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setCodigo(insumo?.codigo ?? "");
      setSinapi(insumo?.sinapi_codigo ?? "");
      setDescricao(insumo?.descricao ?? "");
      setCategoriaId(insumo?.categoria_id ?? "");
      setUnidadeId(insumo?.unidade_id ?? "");
      setNcm(insumo?.ncm ?? "");
      setEspecificacao(insumo?.especificacao_tecnica ?? "");
      setNormas(insumo?.normas_tecnicas ?? "");
      setImagemUrl(insumo?.imagem_url ?? "");
    }
  }, [open, insumo]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("sinapi-imagens")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("sinapi-imagens").getPublicUrl(path);
      setImagemUrl(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar imagem";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!descricao.trim()) { toast.error("Descrição obrigatória"); return; }
    setSaving(true);
    const payload = {
      company_id: companyId,
      codigo: codigo.trim() || null,
      sinapi_codigo: sinapi.trim() || null,
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      unidade_id: unidadeId || null,
      ncm: ncm.trim() || null,
      especificacao_tecnica: especificacao.trim() || null,
      normas_tecnicas: normas.trim() || null,
      imagem_url: imagemUrl.trim() || null,
    };
    const q = insumo
      ? supabase.from("insumos_mestre").update(payload).eq("id", insumo.id)
      : supabase.from("insumos_mestre").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(insumo ? "Atualizado" : "Cadastrado");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo insumo</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{insumo ? "Editar insumo" : "Novo insumo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Código SINAPI</Label>
              <Input value={sinapi} onChange={(e) => setSinapi(e.target.value)} />
            </div>
            <div>
              <Label>Código interno</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div>
              <Label>NCM</Label>
              <Input value={ncm} onChange={(e) => setNcm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição padronizada *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.sigla} — {u.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Especificação técnica</Label>
            <Textarea value={especificacao} onChange={(e) => setEspecificacao(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Normas técnicas</Label>
            <Textarea value={normas} onChange={(e) => setNormas(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Imagem do insumo</Label>
            <div className="flex items-start gap-3">
              <div className="w-24 h-24 rounded border bg-muted/40 overflow-hidden flex items-center justify-center">
                {imagemUrl
                  ? <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                  }}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> {uploading ? "Enviando..." : "Enviar imagem"}
                  </Button>
                  {imagemUrl && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setImagemUrl("")}>
                      Remover
                    </Button>
                  )}
                </div>
                <Input
                  value={imagemUrl}
                  onChange={(e) => setImagemUrl(e.target.value)}
                  placeholder="ou cole uma URL"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
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
    if (!sigla.trim() || !descricao.trim()) { toast.error("Sigla e descrição obrigatórias"); return; }
    const { error } = await supabase.from("unidades_medida").insert({
      company_id: companyId,
      sigla: sigla.trim().toUpperCase(),
      descricao: descricao.trim(),
      unidade_base_id: baseId || null,
      fator_conversao: Number(fator) || 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Unidade criada");
    setOpen(false); setSigla(""); setDescricao(""); setBaseId(""); setFator("1");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova unidade</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Sigla *</Label><Input value={sigla} onChange={(e) => setSigla(e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Unidade base (opcional)</Label>
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.sigla}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fator conversão</Label><Input type="number" value={fator} onChange={(e) => setFator(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimpleNameDialog({
  title, label, trigger, onSave,
}: {
  title: string; label: string; trigger: React.ReactNode;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label>{label}</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            if (!value.trim()) return;
            const ok = await onSave(value.trim());
            if (ok) { setOpen(false); setValue(""); }
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
