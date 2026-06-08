import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Plus, Trash2, FileText, ArrowUp, ArrowDown, ExternalLink, Save, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import {
  listDossies, getDossie, criarDossie, atualizarDossie, excluirDossie,
  adicionarItemDossie, removerItemDossie, reordenarItensDossie,
  listTemplates, getTemplate, upsertTemplate, excluirTemplate, renderTemplate,
} from "@/lib/dossies.functions";

type DossieRow = { id: string; nome: string; descricao: string | null; escopo: string; status: string };
type DossieItem = { id: string; tipo: string; titulo: string; descricao: string | null };
type TemplateRow = { id: string; nome: string; categoria: string; descricao: string | null; variaveis: unknown; ativo: boolean };
type DossieUpdate = { id: string; nome?: string; descricao?: string | null; escopo?: string; status?: "rascunho" | "finalizado" | "arquivado"; observacoes?: string | null };
type ItemAdd = { dossie_id: string; tipo: string; titulo: string; descricao?: string; ref_id?: string; ref_table?: string; storage_path?: string; ordem?: number };

export const Route = createFileRoute("/_app/dossies")({ component: DossiesPage });

const TIPOS_ITEM = [
  { v: "certidao", label: "Certidão" },
  { v: "biblioteca", label: "Biblioteca / Atestado" },
  { v: "procuracao", label: "Procuração" },
  { v: "proposta", label: "Proposta" },
  { v: "contrato", label: "Contrato" },
  { v: "template", label: "Template gerado" },
  { v: "arquivo", label: "Arquivo livre" },
];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  rascunho: "outline",
  finalizado: "default",
  arquivado: "secondary",
};

const DOSSIES_PAGE_SIZE = 12;
const TEMPLATES_PAGE_SIZE = 12;

function DossiesPage() {
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-primary" />
          Dossiês e Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monte pacotes de habilitação reutilizáveis e modelos de documento com variáveis dinâmicas.
        </p>
      </div>

      <Tabs defaultValue="dossies">
        <TabsList>
          <TabsTrigger value="dossies">Dossiês</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="dossies" className="mt-4">
          <DossiesTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Dossiês Tab ============================== */

function DossiesTab() {
  const listFn = useServerFn(listDossies);
  const createFn = useServerFn(criarDossie);
  const delFn = useServerFn(excluirDossie);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["dossies"],
    queryFn: () => listFn({ data: {} }),
  });

  const createMut = useMutation({
    mutationFn: async (p: { nome: string; descricao?: string; escopo?: string }) => createFn({ data: p }),
    onSuccess: (r) => {
      toast.success("Dossiê criado.");
      qc.invalidateQueries({ queryKey: ["dossies"] });
      setSelectedId(r.id);
      setNovoOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["dossies"] });
      setSelectedId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / DOSSIES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = (rows as DossieRow[]).slice(
    (safePage - 1) * DOSSIES_PAGE_SIZE,
    safePage * DOSSIES_PAGE_SIZE,
  );

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Meus dossiês</CardTitle>
            <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
              </DialogTrigger>
              <NovoDossieDialog onCreate={(p) => createMut.mutate(p)} pending={createMut.isPending} />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum dossiê. Clique em <strong>Novo</strong>.
            </div>
          ) : (
            paginatedRows.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left p-2 rounded border transition-colors ${
                  selectedId === d.id ? "bg-muted border-primary/40" : "hover:bg-muted/40 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{d.nome}</div>
                  <Badge variant={STATUS_VARIANTS[d.status] ?? "outline"} className="text-[10px] uppercase">
                    {d.status}
                  </Badge>
                </div>
                {d.descricao && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{d.descricao}</div>
                )}
              </button>
            ))
          )}
          {rows.length > DOSSIES_PAGE_SIZE && (
            <div className="flex flex-col items-center gap-2 border-t pt-3 mt-3 text-xs text-muted-foreground">
              <span>Mostrando {paginatedRows.length} de {rows.length} dossies</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-16 text-center">{safePage}/{totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        {selectedId ? (
          <DossieDetalhe
            id={selectedId}
            onDelete={() => {
              if (confirm("Excluir este dossiê?")) delMut.mutate(selectedId);
            }}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione um dossiê para gerenciar seus itens.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function NovoDossieDialog({ onCreate, pending }: { onCreate: (p: { nome: string; descricao?: string; escopo?: string }) => void; pending: boolean }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [escopo, setEscopo] = useState("habilitacao");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo dossiê</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Habilitação - Pregão 12/2026" />
        </div>
        <div>
          <Label>Escopo</Label>
          <Select value={escopo} onValueChange={setEscopo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="habilitacao">Habilitação</SelectItem>
              <SelectItem value="proposta">Proposta técnica</SelectItem>
              <SelectItem value="contrato">Assinatura de contrato</SelectItem>
              <SelectItem value="execucao">Execução / medições</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!nome || pending}
          onClick={() => onCreate({ nome, descricao: descricao || undefined, escopo })}
        >
          {pending ? "Criando…" : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DossieDetalhe({ id, onDelete }: { id: string; onDelete: () => void }) {
  const getFn = useServerFn(getDossie);
  const updFn = useServerFn(atualizarDossie);
  const addFn = useServerFn(adicionarItemDossie);
  const rmFn = useServerFn(removerItemDossie);
  const reordFn = useServerFn(reordenarItensDossie);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dossie", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const updMut = useMutation({
    mutationFn: async (p: DossieUpdate) => updFn({ data: p }),
    onSuccess: () => {
      toast.success("Atualizado.");
      qc.invalidateQueries({ queryKey: ["dossie", id] });
      qc.invalidateQueries({ queryKey: ["dossies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMut = useMutation({
    mutationFn: async (p: ItemAdd) => addFn({ data: p }),
    onSuccess: () => {
      toast.success("Item adicionado.");
      qc.invalidateQueries({ queryKey: ["dossie", id] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rmMut = useMutation({
    mutationFn: async (itemId: string) => rmFn({ data: { id: itemId } }),
    onSuccess: () => {
      toast.success("Item removido.");
      qc.invalidateQueries({ queryKey: ["dossie", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reordMut = useMutation({
    mutationFn: async (ordem: Array<{ id: string; ordem: number }>) =>
      reordFn({ data: { dossie_id: id, ordem } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dossie", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>;
  }

  const { dossie, itens } = data;

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= itens.length) return;
    const novo = [...itens];
    [novo[idx], novo[target]] = [novo[target], novo[idx]];
    reordMut.mutate(novo.map((it, i) => ({ id: it.id as string, ordem: i })));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{dossie.nome}</CardTitle>
            <div className="text-xs text-muted-foreground">
              Escopo: <strong>{dossie.escopo}</strong> · {itens.length} item(ns)
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={dossie.status} onValueChange={(v) => updMut.mutate({ id, status: v as "rascunho" | "finalizado" | "arquivado" })}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {dossie.descricao && (
          <p className="text-sm text-muted-foreground">{dossie.descricao}</p>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Itens</h3>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Adicionar item</Button>
            </DialogTrigger>
            <AddItemDialog
              onAdd={(p) => addMut.mutate({ dossie_id: id, ...p })}
              pending={addMut.isPending}
            />
          </Dialog>
        </div>

        {itens.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded">
            Nenhum item. Adicione certidões, atestados, procurações ou arquivos.
          </div>
        ) : (
          <div className="space-y-2">
            {(itens as DossieItem[]).map((it, idx) => (
              <div key={it.id} className="flex items-center gap-2 p-2 rounded border bg-card">
                <Badge variant="outline" className="text-[10px] uppercase">{it.tipo}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.titulo}</div>
                  {it.descricao && (
                    <div className="text-xs text-muted-foreground truncate">{it.descricao}</div>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === itens.length - 1}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => rmMut.mutate(it.id as string)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddItemDialog({
  onAdd, pending,
}: {
  onAdd: (p: { tipo: typeof TIPOS_ITEM[number]["v"]; titulo: string; descricao?: string }) => void;
  pending: boolean;
}) {
  const [tipo, setTipo] = useState<string>("biblioteca");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Adicionar item ao dossiê</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_ITEM.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Certidão FGTS 2026" />
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!titulo || pending}
          onClick={() => onAdd({ tipo: tipo as "certidao", titulo, descricao: descricao || undefined })}
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================== Templates Tab ============================== */

function TemplatesTab() {
  const listFn = useServerFn(listTemplates);
  const delFn = useServerFn(excluirTemplate);
  const qc = useQueryClient();
  const [edicaoId, setEdicaoId] = useState<string | "novo" | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => listFn({ data: {} }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removido.");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / TEMPLATES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = (rows as TemplateRow[]).slice(
    (safePage - 1) * TEMPLATES_PAGE_SIZE,
    safePage * TEMPLATES_PAGE_SIZE,
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          Modelos com variáveis no formato <code className="px-1 rounded bg-muted">{"{{nome}}"}</code> — substituídas ao gerar.
        </p>
        <Button onClick={() => setEdicaoId("novo")}>
          <Plus className="w-4 h-4 mr-1" />Novo template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum template. Crie modelos reutilizáveis para declarações, cartas e propostas.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {paginatedRows.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.nome}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px] mr-2">{t.categoria}</Badge>
                      {!t.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                <div className="text-xs">
                  Variáveis:{" "}
                  {Array.isArray(t.variaveis) && t.variaveis.length > 0 ? (
                    (t.variaveis as string[]).map((v) => (
                      <code key={v} className="px-1 rounded bg-muted mr-1">{`{{${v}}}`}</code>
                    ))
                  ) : (
                    <span className="text-muted-foreground">nenhuma</span>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEdicaoId(t.id)}>
                    <FileText className="w-3.5 h-3.5 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenderId(t.id)}>
                    <Sparkles className="w-3.5 h-3.5 mr-1" />Gerar
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="ml-auto h-8 w-8"
                    onClick={() => { if (confirm("Excluir template?")) delMut.mutate(t.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {rows.length > TEMPLATES_PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Mostrando {paginatedRows.length} de {rows.length} templates</span>
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

      {edicaoId && (
        <TemplateEditorDialog
          id={edicaoId === "novo" ? undefined : edicaoId}
          onClose={() => setEdicaoId(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["templates"] });
            setEdicaoId(null);
          }}
        />
      )}
      {renderId && (
        <TemplateRenderDialog id={renderId} onClose={() => setRenderId(null)} />
      )}
    </div>
  );
}

function TemplateEditorDialog({
  id, onClose, onSaved,
}: { id?: string; onClose: () => void; onSaved: () => void }) {
  const getFn = useServerFn(getTemplate);
  const saveFn = useServerFn(upsertTemplate);

  const { data: existing } = useQuery({
    queryKey: ["template", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("declaracao");
  const [descricao, setDescricao] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [ativo, setAtivo] = useState(true);

  // hidratar quando existing chegar
  useState(() => {
    if (existing) {
      setNome((existing.nome as string) ?? "");
      setCategoria((existing.categoria as string) ?? "declaracao");
      setDescricao((existing.descricao as string) ?? "");
      setConteudo((existing.conteudo as string) ?? "");
      setAtivo((existing.ativo as boolean) ?? true);
    }
  });

  const saveMut = useMutation({
    mutationFn: async () =>
      saveFn({ data: { id, nome, categoria, descricao: descricao || undefined, conteudo, ativo } }),
    onSuccess: () => { toast.success("Template salvo."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{id ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Declaração de menor" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="declaracao">Declaração</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="atestado">Atestado</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label>
              Conteúdo · use <code className="px-1 rounded bg-muted">{"{{variavel}}"}</code> para campos dinâmicos
            </Label>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder={"DECLARAÇÃO\n\nA empresa {{razao_social}}, CNPJ {{cnpj}}, declara para fins do Pregão {{numero_pregao}}..."}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome || !conteudo || saveMut.isPending} onClick={() => saveMut.mutate()}>
            <Save className="w-4 h-4 mr-1" />{saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateRenderDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const getFn = useServerFn(getTemplate);
  const renderFn = useServerFn(renderTemplate);

  const { data: tpl } = useQuery({
    queryKey: ["template", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [vars, setVars] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<string | null>(null);

  const renderMut = useMutation({
    mutationFn: async () => renderFn({ data: { template_id: id, variaveis: vars } }),
    onSuccess: (r) => setResultado(r.conteudo),
    onError: (e: Error) => toast.error(e.message),
  });

  const variaveis = (tpl?.variaveis as string[] | undefined) ?? [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerar documento — {tpl?.nome}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Preencha as variáveis</Label>
            {variaveis.length === 0 ? (
              <div className="text-xs text-muted-foreground">Este template não possui variáveis.</div>
            ) : (
              variaveis.map((v) => (
                <div key={v}>
                  <Label className="text-xs">{v}</Label>
                  <Input
                    value={vars[v] ?? ""}
                    onChange={(e) => setVars((s) => ({ ...s, [v]: e.target.value }))}
                  />
                </div>
              ))
            )}
            <Button className="w-full mt-2" onClick={() => renderMut.mutate()} disabled={renderMut.isPending}>
              <Sparkles className="w-4 h-4 mr-1" />
              {renderMut.isPending ? "Gerando…" : "Gerar"}
            </Button>
          </div>
          <div>
            <Label className="text-xs">Resultado</Label>
            <Textarea
              value={resultado ?? ""}
              readOnly
              rows={18}
              className="font-mono text-xs"
              placeholder="Clique em Gerar para ver o documento."
            />
            {resultado && (
              <Button
                variant="outline" size="sm" className="mt-2"
                onClick={() => { void navigator.clipboard.writeText(resultado); toast.success("Copiado."); }}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />Copiar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
