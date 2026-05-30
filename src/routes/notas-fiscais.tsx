import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Search,
  Eye,
  Link2,
  AlertCircle,
  Split,
} from "lucide-react";
import {
  parseNFeXml,
  formatCnpj,
  formatMoney,
  type NFeParsed,
} from "@/lib/nfe-parser";
import { NfeRateioDialog, type RateioItem } from "@/components/NfeRateioDialog";
import type { BudgetRow, ProjectData } from "@/lib/types";

export const Route = createFileRoute("/notas-fiscais")({
  component: NotasFiscaisPage,
  head: () => ({
    meta: [
      { title: "Notas Fiscais (XML NF-e)" },
      {
        name: "description",
        content: "Importação e gestão de notas fiscais eletrônicas.",
      },
    ],
  }),
});

type NotaRow = {
  id: string;
  chave_acesso: string;
  numero: string;
  serie: string | null;
  data_emissao: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  emitente_uf: string | null;
  valor_total: number;
  status: string;
  created_at: string;
};

type ItemRow = {
  id: string;
  numero_item: number;
  codigo_produto: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  insumo_id: string | null;
  match_status: string;
  obra_id: string | null;
  item_codigo: string | null;
  item_descricao: string | null;
};

type ObraLite = { id: string; nome: string; rows: BudgetRow[] };

type InsumoOption = {
  id: string;
  codigo: string | null;
  descricao: string;
};

function NotasFiscaisPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const companyId = company?.id ?? null;
  const role = company?.role ?? null;
  const canEdit = role === "admin" || role === "editor";
  const canDelete = role === "admin";

  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("list");
  const [importing, setImporting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; parsed: NFeParsed }[]>([]);
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [detailNota, setDetailNota] = useState<NotaRow | null>(null);
  const [detailItens, setDetailItens] = useState<ItemRow[]>([]);
  const [insumos, setInsumos] = useState<InsumoOption[]>([]);
  const [obras, setObras] = useState<ObraLite[]>([]);
  const [bulkObra, setBulkObra] = useState<string>("");
  const [bulkComp, setBulkComp] = useState<string>("");
  const [rateioItem, setRateioItem] = useState<RateioItem | null>(null);


  const refresh = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select(
        "id,chave_acesso,numero,serie,data_emissao,emitente_cnpj,emitente_nome,emitente_uf,valor_total,status,created_at",
      )
      .eq("company_id", companyId)
      .order("data_emissao", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) toast.error(error.message);
    setNotas((data as NotaRow[]) || []);
    setLoading(false);
  };

  const loadInsumos = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("insumos_mestre")
      .select("id,codigo,descricao")
      .eq("company_id", companyId)
      .eq("ativo", true)
      .order("descricao")
      .limit(2000);
    setInsumos((data as InsumoOption[]) || []);
  };

  const loadObras = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("company_workspaces")
      .select("workspace")
      .eq("company_id", companyId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (data as any)?.workspace as { obras?: ProjectData[] } | undefined;
    setObras((ws?.obras ?? []).map((o) => ({ id: o.id, nome: o.nome || o.id, rows: o.rows ?? [] })));
  };

  useEffect(() => {
    if (companyId) {
      refresh();
      loadInsumos();
      loadObras();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return notas;
    return notas.filter(
      (n) =>
        n.numero.toLowerCase().includes(s) ||
        (n.emitente_nome || "").toLowerCase().includes(s) ||
        (n.emitente_cnpj || "").includes(s) ||
        n.chave_acesso.includes(s),
    );
  }, [notas, search]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList);
    const parsed: { name: string; parsed: NFeParsed }[] = [];
    const errs: { name: string; error: string }[] = [];
    for (const f of arr) {
      try {
        const text = await f.text();
        const nfe = parseNFeXml(text);
        parsed.push({ name: f.name, parsed: nfe });
      } catch (e) {
        errs.push({ name: f.name, error: (e as Error).message });
      }
    }
    setPendingFiles(parsed);
    setErrors(errs);
    if (parsed.length) toast.success(`${parsed.length} XML(s) lido(s)`);
    if (errs.length) toast.error(`${errs.length} arquivo(s) com erro`);
  };

  const confirmImport = async () => {
    if (!companyId || !user || !pendingFiles.length) return;
    setImporting(true);
    let ok = 0;
    let dup = 0;
    let fail = 0;
    for (const { parsed } of pendingFiles) {
      const { data: notaIns, error: notaErr } = await supabase
        .from("notas_fiscais")
        .insert({
          company_id: companyId,
          chave_acesso: parsed.chave_acesso,
          numero: parsed.numero,
          serie: parsed.serie,
          modelo: parsed.modelo,
          natureza_operacao: parsed.natureza_operacao,
          data_emissao: parsed.data_emissao,
          emitente_cnpj: parsed.emitente_cnpj,
          emitente_nome: parsed.emitente_nome,
          emitente_ie: parsed.emitente_ie,
          emitente_uf: parsed.emitente_uf,
          destinatario_cnpj: parsed.destinatario_cnpj,
          destinatario_nome: parsed.destinatario_nome,
          valor_produtos: parsed.valor_produtos,
          valor_frete: parsed.valor_frete,
          valor_desconto: parsed.valor_desconto,
          valor_outras: parsed.valor_outras,
          valor_icms: parsed.valor_icms,
          valor_ipi: parsed.valor_ipi,
          valor_total: parsed.valor_total,
          xml_content: parsed.xml_content,
          status: "importada",
          imported_by: user.id,
        })
        .select("id")
        .single();
      if (notaErr) {
        if (notaErr.code === "23505") dup++;
        else fail++;
        continue;
      }
      const notaId = notaIns!.id as string;
      if (parsed.itens.length) {
        const itensPayload = parsed.itens.map((it) => ({
          company_id: companyId,
          nota_fiscal_id: notaId,
          numero_item: it.numero_item,
          codigo_produto: it.codigo_produto,
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          unidade: it.unidade,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.valor_total,
          valor_desconto: it.valor_desconto,
          valor_frete: it.valor_frete,
          match_status: "pendente",
        }));
        const { error: itensErr } = await supabase
          .from("nota_fiscal_itens")
          .insert(itensPayload);
        if (itensErr) toast.error(`Itens: ${itensErr.message}`);
      }
      ok++;
    }
    setImporting(false);
    setPendingFiles([]);
    toast.success(
      `Importação: ${ok} ok, ${dup} duplicada(s), ${fail} falha(s)`,
    );
    setTab("list");
    refresh();
  };

  const openDetail = async (nota: NotaRow) => {
    setDetailNota(nota);
    setDetailItens([]);
    setBulkObra("");
    setBulkComp("");
    const { data } = await supabase
      .from("nota_fiscal_itens")
      .select(
        "id,numero_item,codigo_produto,descricao,ncm,cfop,unidade,quantidade,valor_unitario,valor_total,insumo_id,match_status,obra_id,item_codigo,item_descricao",
      )
      .eq("nota_fiscal_id", nota.id)
      .order("numero_item");
    setDetailItens((data as ItemRow[]) || []);
  };

  const vincularApropriacao = async (
    itemId: string,
    obraId: string | null,
    itemCodigo: string | null,
  ) => {
    const obra = obras.find((o) => o.id === obraId);
    const comp = obra?.rows.find((r) => r.codigo === itemCodigo && !r.isGroup);
    const payload = {
      obra_id: obraId,
      item_codigo: itemCodigo,
      item_descricao: comp?.descricao ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("nota_fiscal_itens").update(payload as any).eq("id", itemId);
    if (error) { toast.error(error.message); return; }
    setDetailItens((prev) => prev.map((it) => it.id === itemId ? { ...it, ...payload } : it));
  };

  const aplicarBulk = async () => {
    if (!detailNota) return;
    if (!bulkObra) { toast.error("Selecione a obra"); return; }
    const obra = obras.find((o) => o.id === bulkObra);
    const comp = obra?.rows.find((r) => r.codigo === bulkComp && !r.isGroup);
    const payload = {
      obra_id: bulkObra,
      item_codigo: bulkComp || null,
      item_descricao: comp?.descricao ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("nota_fiscal_itens").update(payload as any).eq("nota_fiscal_id", detailNota.id);
    if (error) { toast.error(error.message); return; }
    setDetailItens((prev) => prev.map((it) => ({ ...it, ...payload })));
    toast.success(`Apropriação aplicada a ${detailItens.length} item(ns)`);
  };


  const vincularInsumo = async (itemId: string, insumoId: string | null) => {
    const { error } = await supabase
      .from("nota_fiscal_itens")
      .update({
        insumo_id: insumoId,
        match_status: insumoId ? "vinculado" : "pendente",
      })
      .eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDetailItens((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, insumo_id: insumoId, match_status: insumoId ? "vinculado" : "pendente" }
          : it,
      ),
    );
    // criar alias automático se for novo vínculo
    if (insumoId && companyId && detailNota) {
      const item = detailItens.find((i) => i.id === itemId);
      if (item) {
        await supabase.from("insumo_aliases").insert({
          company_id: companyId,
          insumo_id: insumoId,
          descricao_alternativa: item.descricao,
          codigo_fornecedor: item.codigo_produto,
          fornecedor: detailNota.emitente_nome,
          cnpj_fornecedor: detailNota.emitente_cnpj,
          origem: "nfe",
        });
      }
    }
  };

  const removeNota = async (id: string) => {
    if (!confirm("Excluir esta nota fiscal e todos os seus itens?")) return;
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Nota excluída");
    refresh();
  };

  if (authLoading || companyLoading) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }
  if (!user) {
    return (
      <div className="p-8">
        <Link to="/login" className="underline">
          Faça login para continuar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
          </Button>
          <FileText className="w-5 h-5" />
          <h1 className="font-semibold">Notas Fiscais (XML NF-e)</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="list">Notas importadas ({notas.length})</TabsTrigger>
            <TabsTrigger value="import" disabled={!canEdit}>
              Importar XML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, emitente, CNPJ ou chave…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Série</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Emitente</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Nenhuma nota encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono">{n.numero}</TableCell>
                          <TableCell>{n.serie || "—"}</TableCell>
                          <TableCell>
                            {n.data_emissao
                              ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {n.emitente_nome || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatCnpj(n.emitente_cnpj)}
                          </TableCell>
                          <TableCell>{n.emitente_uf || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(n.valor_total)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{n.status}</Badge>
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDetail(n)}
                              title="Ver itens"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeNota(n.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold mb-1">Importar arquivos XML de NF-e</h2>
                <p className="text-sm text-muted-foreground">
                  Selecione um ou vários arquivos .xml. O sistema lê os dados,
                  evita duplicidades pela chave de acesso e armazena cada item da nota.
                </p>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed cursor-pointer hover:bg-accent">
                  <Upload className="w-4 h-4" />
                  <span>Selecionar XML(s)</span>
                  <input
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              </div>

              {errors.length > 0 && (
                <div className="space-y-1">
                  {errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-destructive"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-mono">{err.name}</span>: {err.error}
                    </div>
                  ))}
                </div>
              )}

              {pendingFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">
                    Pré-visualização ({pendingFiles.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Nº NF</TableHead>
                          <TableHead>Emitente</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingFiles.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{f.name}</TableCell>
                            <TableCell>{f.parsed.numero}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {f.parsed.emitente_nome}
                            </TableCell>
                            <TableCell>{f.parsed.itens.length}</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(f.parsed.valor_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={confirmImport} disabled={importing}>
                      {importing ? "Importando…" : `Confirmar importação`}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPendingFiles([])}
                      disabled={importing}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!detailNota} onOpenChange={(o) => !o && setDetailNota(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              NF-e {detailNota?.numero} — {detailNota?.emitente_nome}
            </DialogTitle>
          </DialogHeader>
          {detailNota && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Chave de acesso</div>
                  <div className="font-mono text-xs break-all">
                    {detailNota.chave_acesso}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">CNPJ emitente</div>
                  <div className="font-mono">
                    {formatCnpj(detailNota.emitente_cnpj)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Emissão</div>
                  <div>
                    {detailNota.data_emissao
                      ? new Date(detailNota.data_emissao).toLocaleString("pt-BR")
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Valor total</div>
                  <div className="font-medium">{formatMoney(detailNota.valor_total)}</div>
                </div>
              </div>

              {canEdit && obras.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <div className="text-sm font-medium">Apropriar custo da nota inteira</div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px]">
                      <div className="text-xs text-muted-foreground mb-1">Obra</div>
                      <Select value={bulkObra} onValueChange={(v) => { setBulkObra(v); setBulkComp(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[280px] flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Composição / Item do orçamento</div>
                      <Select value={bulkComp} onValueChange={setBulkComp} disabled={!bulkObra}>
                        <SelectTrigger><SelectValue placeholder={bulkObra ? "Selecione…" : "Escolha a obra primeiro"} /></SelectTrigger>
                        <SelectContent>
                          {(obras.find((o) => o.id === bulkObra)?.rows ?? [])
                            .filter((r) => !r.isGroup && r.codigo)
                            .map((r) => (
                              <SelectItem key={r.codigo} value={r.codigo}>
                                <span className="font-mono mr-2">{r.codigo}</span>{r.descricao}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={aplicarBulk} disabled={!bulkObra}>Aplicar a todos os itens</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define obra + composição em todos os itens desta NF-e de uma vez. Você ainda pode ajustar item a item abaixo.
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-2">
                  Itens ({detailItens.length}){" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    — vincule cada item ao insumo, à obra e à composição do orçamento
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">V. Total</TableHead>
                        <TableHead>Insumo mestre</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Composição</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItens.map((it) => {
                        const obraSel = obras.find((o) => o.id === it.obra_id);
                        const compRows = (obraSel?.rows ?? []).filter((r) => !r.isGroup && r.codigo);
                        return (
                          <TableRow key={it.id}>
                            <TableCell>{it.numero_item}</TableCell>
                            <TableCell className="max-w-xs text-xs">{it.descricao}</TableCell>
                            <TableCell className="text-right text-xs">{it.quantidade.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right">{formatMoney(it.valor_total)}</TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Select
                                  value={it.insumo_id || "__none__"}
                                  onValueChange={(v) => vincularInsumo(it.id, v === "__none__" ? null : v)}
                                >
                                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Insumo…" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__"><span className="text-muted-foreground">(não vinculado)</span></SelectItem>
                                    {insumos.map((ins) => (
                                      <SelectItem key={ins.id} value={ins.id}>
                                        {ins.codigo ? `[${ins.codigo}] ` : ""}{ins.descricao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : it.insumo_id ? (
                                <Badge variant="secondary"><Link2 className="w-3 h-3 mr-1" /> ok</Badge>
                              ) : (
                                <Badge variant="outline">pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Select
                                  value={it.obra_id || "__none__"}
                                  onValueChange={(v) => vincularApropriacao(it.id, v === "__none__" ? null : v, null)}
                                >
                                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Obra…" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__"><span className="text-muted-foreground">(nenhuma)</span></SelectItem>
                                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs">{obraSel?.nome ?? "—"}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Select
                                  value={it.item_codigo || "__none__"}
                                  onValueChange={(v) => vincularApropriacao(it.id, it.obra_id, v === "__none__" ? null : v)}
                                  disabled={!it.obra_id}
                                >
                                  <SelectTrigger className="w-[260px]">
                                    <SelectValue placeholder={it.obra_id ? "Composição…" : "Defina obra"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__"><span className="text-muted-foreground">(nenhuma)</span></SelectItem>
                                    {compRows.map((r) => (
                                      <SelectItem key={r.codigo} value={r.codigo}>
                                        <span className="font-mono mr-2">{r.codigo}</span>{r.descricao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : it.item_codigo ? (
                                <Badge variant="secondary">{it.item_codigo}</Badge>
                              ) : (
                                <Badge variant="outline">não apropriado</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRateioItem({
                                    id: it.id,
                                    descricao: it.descricao,
                                    unidade: it.unidade,
                                    quantidade: it.quantidade,
                                    valor_unitario: it.valor_unitario,
                                    valor_total: it.valor_total,
                                    insumo_id: it.insumo_id,
                                  })}
                                  title="Apropriar com rateio (várias composições)"
                                >
                                  <Split className="w-3 h-3 mr-1" /> Rateio
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {companyId && detailNota && (
        <NfeRateioDialog
          open={!!rateioItem}
          onOpenChange={(o) => !o && setRateioItem(null)}
          companyId={companyId}
          item={rateioItem}
          nota={{ id: detailNota.id, numero: detailNota.numero, emitente_nome: detailNota.emitente_nome }}
          obras={obras}
          onSaved={() => detailNota && openDetail(detailNota)}
        />
      )}
    </div>
  );
}
