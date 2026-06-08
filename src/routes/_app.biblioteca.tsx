/**
 * Fase 6 — Biblioteca Técnica
 * Abas: Responsáveis Técnicos · Atestados · CATs · ARTs
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  HardHat, FileText, Award, ClipboardCheck, Plus, Trash2, Upload, Edit,
  ExternalLink, Search, BookOpen, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";

import {
  listResponsaveisTecnicos, saveResponsavelTecnico, deleteResponsavelTecnico,
  listAtestados, saveAtestado, deleteAtestado,
  listCats, saveCat, deleteCat,
  listArts, saveArt, deleteArt,
  uploadBibliotecaPDF, getBibliotecaSignedUrl,
  listEditaisParaSugestaoAtestados, sugerirAtestadosParaEdital,
} from "@/lib/biblioteca.functions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/biblioteca")({ component: BibliotecaPage });

const brl = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const BIBLIOTECA_PAGE_SIZE = 20;

function BibliotecaPage() {
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Biblioteca Técnica
          </h1>
          <p className="text-sm text-muted-foreground">
            Acervo para qualificação técnica em licitações: responsáveis, atestados, CATs e ARTs.
          </p>
        </div>
      </div>

      <Tabs defaultValue="rt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rt"><HardHat className="w-4 h-4 mr-1" /> Responsáveis</TabsTrigger>
          <TabsTrigger value="atestados"><Award className="w-4 h-4 mr-1" /> Atestados</TabsTrigger>
          <TabsTrigger value="sugestoes"><Sparkles className="w-4 h-4 mr-1" /> Sugestoes</TabsTrigger>
          <TabsTrigger value="cats"><ClipboardCheck className="w-4 h-4 mr-1" /> CATs</TabsTrigger>
          <TabsTrigger value="arts"><FileText className="w-4 h-4 mr-1" /> ARTs</TabsTrigger>
        </TabsList>
        <TabsContent value="rt"><ResponsaveisTab /></TabsContent>
        <TabsContent value="atestados"><AtestadosTab /></TabsContent>
        <TabsContent value="sugestoes"><SugestoesAtestadosTab /></TabsContent>
        <TabsContent value="cats"><CatsTab /></TabsContent>
        <TabsContent value="arts"><ArtsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== RESPONSÁVEIS ============================== */

type RT = {
  id: string; nome: string; cpf: string | null; email: string | null; telefone: string | null;
  formacao: string | null; conselho: string | null; numero_registro: string | null;
  uf_registro: string | null; ativo: boolean; observacoes: string | null;
};

function ResponsaveisTab() {
  const listFn = useServerFn(listResponsaveisTecnicos);
  const saveFn = useServerFn(saveResponsavelTecnico);
  const delFn = useServerFn(deleteResponsavelTecnico);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["rt"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<RT> | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["rt"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []) as RT[];
  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    return !q || r.nome.toLowerCase().includes(q) || (r.numero_registro ?? "").toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / BIBLIOTECA_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * BIBLIOTECA_PAGE_SIZE,
    safePage * BIBLIOTECA_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Responsáveis Técnicos ({rows.length})</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 w-56"
                placeholder="Buscar..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button size="sm" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground py-4">Carregando…</div> :
          filtered.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Nenhum responsável técnico cadastrado.</div> :
          <div className="space-y-2">
            {paginated.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.nome}</span>
                    {r.conselho && r.numero_registro && (
                      <Badge variant="outline" className="text-xs">{r.conselho} {r.numero_registro}{r.uf_registro ? `/${r.uf_registro}` : ""}</Badge>
                    )}
                    {!r.ativo && <Badge variant="secondary" className="text-xs">inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[r.formacao, r.email, r.telefone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Edit className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delMut.mutate(r.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        }
        {filtered.length > BIBLIOTECA_PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
            <span>Mostrando {paginated.length} de {filtered.length} responsaveis</span>
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
      </CardContent>

      {editing !== null && (
        <RTDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            try {
              await saveFn({ data: v });
              toast.success("Salvo.");
              qc.invalidateQueries({ queryKey: ["rt"] });
              setEditing(null);
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}
    </Card>
  );
}

function RTDialog({ value, onClose, onSave }: { value: Partial<RT>; onClose: () => void; onSave: (v: Partial<RT>) => Promise<void> }) {
  const [f, setF] = useState<Partial<RT>>({ ativo: true, ...value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{value.id ? "Editar" : "Novo"} responsável técnico</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div><Label>CPF</Label><Input value={f.cpf ?? ""} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></div>
          <div><Label>Formação</Label><Input placeholder="Engº Civil" value={f.formacao ?? ""} onChange={(e) => setF({ ...f, formacao: e.target.value })} /></div>
          <div><Label>Conselho</Label>
            <Select value={f.conselho ?? ""} onValueChange={(v) => setF({ ...f, conselho: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CREA">CREA</SelectItem>
                <SelectItem value="CAU">CAU</SelectItem>
                <SelectItem value="CFT">CFT</SelectItem>
                <SelectItem value="CRQ">CRQ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Registro</Label><Input value={f.numero_registro ?? ""} onChange={(e) => setF({ ...f, numero_registro: e.target.value })} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={f.uf_registro ?? ""} onChange={(e) => setF({ ...f, uf_registro: e.target.value.toUpperCase() })} /></div>
          <div><Label>E-mail</Label><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={f.telefone ?? ""} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <div className="col-span-2 flex items-center gap-2">
            <input id="ativo" type="checkbox" checked={f.ativo ?? true} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
            <Label htmlFor="ativo">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!f.nome || f.nome.length < 2} onClick={() => onSave(f)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== ATESTADOS ============================== */

type Atestado = {
  id: string; titulo: string; contratante_nome: string | null; contratante_cnpj: string | null;
  objeto: string | null; valor: number | null; data_emissao: string | null;
  periodo_inicio: string | null; periodo_fim: string | null; observacoes: string | null;
  storage_path: string | null; nome_arquivo: string | null;
  responsavel_id: string | null;
  responsavel?: { id: string; nome: string; numero_registro: string | null; conselho: string | null } | null;
};


type EditalSugestaoOption = {
  id: string;
  titulo: string;
  orgao: string | null;
  valor_estimado: number | null;
  data_abertura: string | null;
};

type SugestaoAtestado = {
  id: string;
  titulo: string;
  contratante_nome: string | null;
  objeto: string | null;
  valor: number | null;
  data_emissao: string | null;
  storage_path: string | null;
  responsavel: { nome: string; conselho: string | null; numero_registro: string | null } | null;
  score: number;
  matched_keywords: string[];
  reasons: string[];
};

type SugestaoAtestadoResult = {
  edital: { id: string; titulo: string; orgao: string | null; valor_estimado: number | null };
  keywords: string[];
  sugestoes: SugestaoAtestado[];
};

function scoreTone(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (score >= 45) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

function SugestoesAtestadosTab() {
  const listEditaisFn = useServerFn(listEditaisParaSugestaoAtestados);
  const sugestaoFn = useServerFn(sugerirAtestadosParaEdital);
  const urlFn = useServerFn(getBibliotecaSignedUrl);
  const [editalId, setEditalId] = useState("");
  const { data: editais, isLoading } = useQuery({ queryKey: ["editais-sugestao-atestados"], queryFn: () => listEditaisFn() });
  const sugestaoMut = useMutation({
    mutationFn: (id: string) => sugestaoFn({ data: { edital_id: id } }) as Promise<SugestaoAtestadoResult>,
    onError: (e: Error) => toast.error(e.message),
  });
  const result = sugestaoMut.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Sugestao de atestados</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Cruza objeto, checklist e valor estimado do edital com a biblioteca tecnica cadastrada.</p>
          </div>
          <div className="flex gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <Select value={editalId} onValueChange={(v) => { setEditalId(v); sugestaoMut.reset(); }}>
              <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder={isLoading ? "Carregando editais..." : "Selecione um edital"} /></SelectTrigger>
              <SelectContent>
                {((editais ?? []) as EditalSugestaoOption[]).map((ed) => (
                  <SelectItem key={ed.id} value={ed.id}>{ed.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!editalId || sugestaoMut.isPending} onClick={() => sugestaoMut.mutate(editalId)}>
              <Sparkles className="w-4 h-4 mr-1" /> Analisar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">Selecione um edital para ranquear os atestados mais aderentes.</div>
        )}
        {result && (
          <>
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{result.edital.titulo}</div>
                  <div className="text-xs text-muted-foreground">{result.edital.orgao ?? "Orgao nao informado"} - {brl(result.edital.valor_estimado)}</div>
                </div>
                <Badge variant="outline">{result.sugestoes.length} sugestoes</Badge>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {result.keywords.slice(0, 14).map((kw) => <Badge key={kw} variant="secondary" className="text-[10px]">{kw}</Badge>)}
              </div>
            </div>

            {result.sugestoes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">Nenhum atestado cadastrado para comparar.</div>
            ) : (
              <div className="space-y-2">
                {result.sugestoes.map((a, idx) => (
                  <div key={a.id} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={scoreTone(a.score)}>#{idx + 1} - {a.score}%</Badge>
                          <span className="font-medium">{a.titulo}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {a.contratante_nome ?? "Contratante nao informado"} - {brl(a.valor)} - emissao {fmtDate(a.data_emissao)}
                        </div>
                      </div>
                      {a.storage_path && (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          try { const { url } = await urlFn({ data: { entidade: "atestado", id: a.id } }); window.open(url, "_blank"); }
                          catch (e) { toast.error((e as Error).message); }
                        }}><ExternalLink className="w-4 h-4" /></Button>
                      )}
                    </div>
                    {a.objeto && <div className="text-xs text-muted-foreground line-clamp-2">{a.objeto}</div>}
                    <div className="flex gap-1.5 flex-wrap">
                      {a.reasons.map((reason) => <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>)}
                    </div>
                    {a.matched_keywords.length > 0 && (
                      <div className="text-[11px] text-muted-foreground">Termos: {a.matched_keywords.join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AtestadosTab() {
  const listFn = useServerFn(listAtestados);
  const saveFn = useServerFn(saveAtestado);
  const delFn = useServerFn(deleteAtestado);
  const listRtFn = useServerFn(listResponsaveisTecnicos);
  const uploadFn = useServerFn(uploadBibliotecaPDF);
  const urlFn = useServerFn(getBibliotecaSignedUrl);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["atestados"], queryFn: () => listFn() });
  const { data: rts } = useQuery({ queryKey: ["rt"], queryFn: () => listRtFn() });
  const [editing, setEditing] = useState<Partial<Atestado> | null>(null);
  const [page, setPage] = useState(1);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["atestados"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []) as Atestado[];
  const totalPages = Math.max(1, Math.ceil(rows.length / BIBLIOTECA_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (safePage - 1) * BIBLIOTECA_PAGE_SIZE,
    safePage * BIBLIOTECA_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Atestados de Capacidade Técnica ({rows.length})</CardTitle>
          <Button size="sm" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground py-4">Carregando…</div> :
          rows.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem atestados.</div> :
          <div className="space-y-2">
            {paginatedRows.map((a) => (
              <div key={a.id} className="p-3 border rounded space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.contratante_nome ?? "—"} {a.contratante_cnpj ? `(${a.contratante_cnpj})` : ""}
                    </div>
                    <div className="text-xs mt-1 flex gap-2 flex-wrap">
                      <Badge variant="outline">Valor: {brl(a.valor)}</Badge>
                      <Badge variant="outline">Emissão: {fmtDate(a.data_emissao)}</Badge>
                      {(a.periodo_inicio || a.periodo_fim) && (
                        <Badge variant="outline">Período: {fmtDate(a.periodo_inicio)} → {fmtDate(a.periodo_fim)}</Badge>
                      )}
                      {a.responsavel && <Badge variant="secondary">{a.responsavel.nome}</Badge>}
                    </div>
                    {a.objeto && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.objeto}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {a.storage_path && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { const { url } = await urlFn({ data: { entidade: "atestado", id: a.id } }); window.open(url, "_blank"); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><ExternalLink className="w-4 h-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delMut.mutate(a.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
        {rows.length > BIBLIOTECA_PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
            <span>Mostrando {paginatedRows.length} de {rows.length} atestados</span>
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
      </CardContent>

      {editing !== null && (
        <AtestadoDialog
          value={editing}
          rts={(rts ?? []) as RT[]}
          onClose={() => setEditing(null)}
          onSave={async (v, file) => {
            try {
              const { id } = await saveFn({ data: v });
              if (file) await uploadFile(uploadFn, "atestado", id, file);
              toast.success("Salvo.");
              qc.invalidateQueries({ queryKey: ["atestados"] });
              setEditing(null);
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}
    </Card>
  );
}

async function uploadFile(
  uploadFn: (args: { data: { entidade: "atestado" | "cat" | "art"; id: string; nome_arquivo: string; mime_type: string; base64: string } }) => Promise<{ ok: boolean }>,
  entidade: "atestado" | "cat" | "art",
  id: string,
  file: File,
) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo máximo 20MB.");
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  const base64 = btoa(bin);
  await uploadFn({ data: { entidade, id, nome_arquivo: file.name, mime_type: file.type || "application/pdf", base64 } });
}

function AtestadoDialog({ value, rts, onClose, onSave }: {
  value: Partial<Atestado>; rts: RT[]; onClose: () => void;
  onSave: (v: Partial<Atestado>, file: File | null) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Atestado>>(value);
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{value.id ? "Editar" : "Novo"} atestado</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Título *</Label><Input value={f.titulo ?? ""} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div><Label>Contratante</Label><Input value={f.contratante_nome ?? ""} onChange={(e) => setF({ ...f, contratante_nome: e.target.value })} /></div>
          <div><Label>CNPJ</Label><Input value={f.contratante_cnpj ?? ""} onChange={(e) => setF({ ...f, contratante_cnpj: e.target.value })} /></div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.valor ?? ""} onChange={(e) => setF({ ...f, valor: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Data de emissão</Label><Input type="date" value={f.data_emissao ?? ""} onChange={(e) => setF({ ...f, data_emissao: e.target.value || null })} /></div>
          <div><Label>Início execução</Label><Input type="date" value={f.periodo_inicio ?? ""} onChange={(e) => setF({ ...f, periodo_inicio: e.target.value || null })} /></div>
          <div><Label>Fim execução</Label><Input type="date" value={f.periodo_fim ?? ""} onChange={(e) => setF({ ...f, periodo_fim: e.target.value || null })} /></div>
          <div className="col-span-2"><Label>Responsável técnico</Label>
            <Select value={f.responsavel_id ?? "_none"} onValueChange={(v) => setF({ ...f, responsavel_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— nenhum —</SelectItem>
                {rts.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}{r.numero_registro ? ` (${r.conselho} ${r.numero_registro})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Objeto</Label><Textarea rows={3} value={f.objeto ?? ""} onChange={(e) => setF({ ...f, objeto: e.target.value })} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>{f.storage_path ? "Substituir PDF" : "Anexar PDF"} {f.nome_arquivo && <span className="text-xs text-muted-foreground">(atual: {f.nome_arquivo})</span>}</Label>
            <Input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!f.titulo || f.titulo.length < 2} onClick={() => onSave(f, file)}>
            <Upload className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== CATs ============================== */

type Cat = {
  id: string; numero_cat: string; conselho: string | null; uf: string | null;
  data_emissao: string | null; atividades: string | null; observacoes: string | null;
  storage_path: string | null; nome_arquivo: string | null;
  responsavel_id: string | null; atestado_id: string | null;
  responsavel?: { id: string; nome: string } | null;
  atestado?: { id: string; titulo: string } | null;
};

function CatsTab() {
  const listFn = useServerFn(listCats);
  const saveFn = useServerFn(saveCat);
  const delFn = useServerFn(deleteCat);
  const listRtFn = useServerFn(listResponsaveisTecnicos);
  const listAtFn = useServerFn(listAtestados);
  const uploadFn = useServerFn(uploadBibliotecaPDF);
  const urlFn = useServerFn(getBibliotecaSignedUrl);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cats"], queryFn: () => listFn() });
  const { data: rts } = useQuery({ queryKey: ["rt"], queryFn: () => listRtFn() });
  const { data: atestados } = useQuery({ queryKey: ["atestados"], queryFn: () => listAtFn() });
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [page, setPage] = useState(1);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["cats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []) as Cat[];
  const totalPages = Math.max(1, Math.ceil(rows.length / BIBLIOTECA_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (safePage - 1) * BIBLIOTECA_PAGE_SIZE,
    safePage * BIBLIOTECA_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">CATs ({rows.length})</CardTitle>
          <Button size="sm" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground py-4">Carregando…</div> :
          rows.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem CATs.</div> :
          <div className="space-y-2">
            {paginatedRows.map((c) => (
              <div key={c.id} className="p-3 border rounded">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">CAT {c.numero_cat} {c.conselho && `· ${c.conselho}${c.uf ? "/" + c.uf : ""}`}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                      <Badge variant="outline">Emissão: {fmtDate(c.data_emissao)}</Badge>
                      {c.responsavel && <Badge variant="secondary">{c.responsavel.nome}</Badge>}
                      {c.atestado && <Badge variant="outline">↳ {c.atestado.titulo}</Badge>}
                    </div>
                    {c.atividades && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.atividades}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.storage_path && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { const { url } = await urlFn({ data: { entidade: "cat", id: c.id } }); window.open(url, "_blank"); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><ExternalLink className="w-4 h-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delMut.mutate(c.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
        {rows.length > BIBLIOTECA_PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
            <span>Mostrando {paginatedRows.length} de {rows.length} CATs</span>
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
      </CardContent>

      {editing !== null && (
        <CatDialog
          value={editing}
          rts={(rts ?? []) as RT[]}
          atestados={(atestados ?? []) as Atestado[]}
          onClose={() => setEditing(null)}
          onSave={async (v, file) => {
            try {
              const { id } = await saveFn({ data: v });
              if (file) await uploadFile(uploadFn, "cat", id, file);
              toast.success("Salvo.");
              qc.invalidateQueries({ queryKey: ["cats"] });
              setEditing(null);
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}
    </Card>
  );
}

function CatDialog({ value, rts, atestados, onClose, onSave }: {
  value: Partial<Cat>; rts: RT[]; atestados: Atestado[]; onClose: () => void;
  onSave: (v: Partial<Cat>, file: File | null) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Cat>>(value);
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{value.id ? "Editar" : "Nova"} CAT</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Número *</Label><Input value={f.numero_cat ?? ""} onChange={(e) => setF({ ...f, numero_cat: e.target.value })} /></div>
          <div><Label>Conselho</Label>
            <Select value={f.conselho ?? ""} onValueChange={(v) => setF({ ...f, conselho: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CREA">CREA</SelectItem>
                <SelectItem value="CAU">CAU</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>UF</Label><Input maxLength={2} value={f.uf ?? ""} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} /></div>
          <div><Label>Data emissão</Label><Input type="date" value={f.data_emissao ?? ""} onChange={(e) => setF({ ...f, data_emissao: e.target.value || null })} /></div>
          <div className="col-span-2"><Label>Responsável técnico</Label>
            <Select value={f.responsavel_id ?? "_none"} onValueChange={(v) => setF({ ...f, responsavel_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— nenhum —</SelectItem>
                {rts.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Atestado vinculado</Label>
            <Select value={f.atestado_id ?? "_none"} onValueChange={(v) => setF({ ...f, atestado_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— nenhum —</SelectItem>
                {atestados.map((a) => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Atividades técnicas</Label><Textarea rows={3} value={f.atividades ?? ""} onChange={(e) => setF({ ...f, atividades: e.target.value })} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>{f.storage_path ? "Substituir PDF" : "Anexar PDF"} {f.nome_arquivo && <span className="text-xs text-muted-foreground">(atual: {f.nome_arquivo})</span>}</Label>
            <Input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!f.numero_cat || f.numero_cat.length < 1} onClick={() => onSave(f, file)}>
            <Upload className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== ARTs ============================== */

type Art = {
  id: string; numero_art: string; conselho: string | null; uf: string | null;
  tipo: string; contratante: string | null; objeto: string | null;
  data_emissao: string | null; data_inicio: string | null; data_termino: string | null;
  valor_contrato: number | null; status: string; observacoes: string | null;
  storage_path: string | null; nome_arquivo: string | null;
  responsavel_id: string | null;
  responsavel?: { id: string; nome: string } | null;
};

const ART_TIPO_LABEL: Record<string, string> = {
  execucao: "Execução", projeto: "Projeto", fiscalizacao: "Fiscalização",
  consultoria: "Consultoria", outros: "Outros",
};
const STATUS_COLOR: Record<string, string> = {
  ativa: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  baixada: "bg-muted text-muted-foreground",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
  vencida: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

function ArtsTab() {
  const listFn = useServerFn(listArts);
  const saveFn = useServerFn(saveArt);
  const delFn = useServerFn(deleteArt);
  const listRtFn = useServerFn(listResponsaveisTecnicos);
  const uploadFn = useServerFn(uploadBibliotecaPDF);
  const urlFn = useServerFn(getBibliotecaSignedUrl);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["arts"], queryFn: () => listFn() });
  const { data: rts } = useQuery({ queryKey: ["rt"], queryFn: () => listRtFn() });
  const [editing, setEditing] = useState<Partial<Art> | null>(null);
  const [page, setPage] = useState(1);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["arts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []) as Art[];
  const totalPages = Math.max(1, Math.ceil(rows.length / BIBLIOTECA_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (safePage - 1) * BIBLIOTECA_PAGE_SIZE,
    safePage * BIBLIOTECA_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">ARTs ({rows.length})</CardTitle>
          <Button size="sm" onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground py-4">Carregando…</div> :
          rows.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem ARTs.</div> :
          <div className="space-y-2">
            {paginatedRows.map((a) => (
              <div key={a.id} className="p-3 border rounded">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">ART {a.numero_art}</span>
                      <Badge variant="outline" className="text-xs">{ART_TIPO_LABEL[a.tipo] ?? a.tipo}</Badge>
                      <Badge className={`text-xs ${STATUS_COLOR[a.status] ?? ""}`} variant="outline">{a.status}</Badge>
                      {a.conselho && <Badge variant="outline" className="text-xs">{a.conselho}{a.uf ? `/${a.uf}` : ""}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.contratante ?? "—"} {a.responsavel && `· RT: ${a.responsavel.nome}`}
                    </div>
                    <div className="text-xs mt-1 flex gap-2 flex-wrap">
                      <Badge variant="outline">Emissão: {fmtDate(a.data_emissao)}</Badge>
                      {(a.data_inicio || a.data_termino) && (
                        <Badge variant="outline">{fmtDate(a.data_inicio)} → {fmtDate(a.data_termino)}</Badge>
                      )}
                      <Badge variant="outline">Contrato: {brl(a.valor_contrato)}</Badge>
                    </div>
                    {a.objeto && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.objeto}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {a.storage_path && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { const { url } = await urlFn({ data: { entidade: "art", id: a.id } }); window.open(url, "_blank"); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><ExternalLink className="w-4 h-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delMut.mutate(a.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
        {rows.length > BIBLIOTECA_PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
            <span>Mostrando {paginatedRows.length} de {rows.length} ARTs</span>
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
      </CardContent>

      {editing !== null && (
        <ArtDialog
          value={editing}
          rts={(rts ?? []) as RT[]}
          onClose={() => setEditing(null)}
          onSave={async (v, file) => {
            try {
              const { id } = await saveFn({ data: v });
              if (file) await uploadFile(uploadFn, "art", id, file);
              toast.success("Salvo.");
              qc.invalidateQueries({ queryKey: ["arts"] });
              setEditing(null);
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      )}
    </Card>
  );
}

function ArtDialog({ value, rts, onClose, onSave }: {
  value: Partial<Art>; rts: RT[]; onClose: () => void;
  onSave: (v: Partial<Art>, file: File | null) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Art>>({ tipo: "execucao", status: "ativa", ...value });
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{value.id ? "Editar" : "Nova"} ART</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Número *</Label><Input value={f.numero_art ?? ""} onChange={(e) => setF({ ...f, numero_art: e.target.value })} /></div>
          <div><Label>Tipo</Label>
            <Select value={f.tipo ?? "execucao"} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ART_TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Conselho</Label>
            <Select value={f.conselho ?? ""} onValueChange={(v) => setF({ ...f, conselho: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CREA">CREA</SelectItem>
                <SelectItem value="CAU">CAU</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>UF</Label><Input maxLength={2} value={f.uf ?? ""} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} /></div>
          <div className="col-span-2"><Label>Responsável técnico</Label>
            <Select value={f.responsavel_id ?? "_none"} onValueChange={(v) => setF({ ...f, responsavel_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— nenhum —</SelectItem>
                {rts.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Contratante</Label><Input value={f.contratante ?? ""} onChange={(e) => setF({ ...f, contratante: e.target.value })} /></div>
          <div><Label>Data emissão</Label><Input type="date" value={f.data_emissao ?? ""} onChange={(e) => setF({ ...f, data_emissao: e.target.value || null })} /></div>
          <div><Label>Valor contrato (R$)</Label><Input type="number" step="0.01" value={f.valor_contrato ?? ""} onChange={(e) => setF({ ...f, valor_contrato: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Início</Label><Input type="date" value={f.data_inicio ?? ""} onChange={(e) => setF({ ...f, data_inicio: e.target.value || null })} /></div>
          <div><Label>Término</Label><Input type="date" value={f.data_termino ?? ""} onChange={(e) => setF({ ...f, data_termino: e.target.value || null })} /></div>
          <div className="col-span-2"><Label>Status</Label>
            <Select value={f.status ?? "ativa"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="baixada">Baixada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Objeto</Label><Textarea rows={3} value={f.objeto ?? ""} onChange={(e) => setF({ ...f, objeto: e.target.value })} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>{f.storage_path ? "Substituir PDF" : "Anexar PDF"} {f.nome_arquivo && <span className="text-xs text-muted-foreground">(atual: {f.nome_arquivo})</span>}</Label>
            <Input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!f.numero_art || f.numero_art.length < 1} onClick={() => onSave(f, file)}>
            <Upload className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
