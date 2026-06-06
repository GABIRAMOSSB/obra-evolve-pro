import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Plus, FileText, Upload, Trash2, RefreshCw, ExternalLink,
  CheckCircle2, XCircle, MinusCircle, Clock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  listEditais,
  createEdital,
  deleteEdital,
  analyzeEdital,
  listChecklist,
  updateChecklistItem,
  uploadEditalDocumento,
  listEditalDocumentos,
  getEditalDocumentoUrl,
  extractDocumentoTexto,
  indexarEditalRAG,
  perguntarEdital,
  ragStatus,
  type ChecklistRow,
} from "@/lib/editais.functions";

export const Route = createFileRoute("/_app/editais")({
  component: EditaisPage,
});

const CATEGORIA_LABEL: Record<string, string> = {
  habilitacao_juridica: "Habilitação Jurídica",
  regularidade_fiscal: "Regularidade Fiscal",
  qualificacao_tecnica: "Qualificação Técnica",
  qualificacao_economica: "Qualificação Econômico-Financeira",
  documentos_proposta: "Documentos da Proposta",
  outros: "Outros",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-muted text-muted-foreground" },
  processando: { label: "Processando IA", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  analisado: { label: "Analisado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
};

function EditaisPage() {
  const listFn = useServerFn(listEditais);
  const createFn = useServerFn(createEdital);
  const deleteFn = useServerFn(deleteEdital);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: editais, isLoading } = useQuery({
    queryKey: ["editais"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Edital removido.");
      qc.invalidateQueries({ queryKey: ["editais"] });
      if (selectedId) setSelectedId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Editais IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise automática de editais com IA: resumo executivo + checklist de habilitação.
          </p>
        </div>
        <CreateEditalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={async (payload) => {
            try {
              await createFn({ data: payload });
              toast.success("Edital criado.");
              qc.invalidateQueries({ queryKey: ["editais"] });
              setCreateOpen(false);
            } catch (e) { toast.error((e as Error).message); }
          }}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr,1.4fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editais ({editais?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
            ) : (editais ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Nenhum edital. Crie um manualmente ou importe do Radar PNCP.
              </div>
            ) : (
              (editais ?? []).map((e) => {
                const st = STATUS_LABEL[e.status] ?? STATUS_LABEL.novo;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left p-3 rounded border transition-colors ${
                      selectedId === e.id ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{e.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.orgao ?? "Órgão N/I"} · {e.modalidade ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Abertura: {fmtDate(e.data_abertura)} · {brl(e.valor_estimado)} · {e.checklist_count} item(ns)
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${st.cls}`}>
                        {st.label}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div>
          {selectedId ? (
            <EditalDetail
              id={selectedId}
              onDeleted={() => delMut.mutate(selectedId)}
            />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Selecione um edital para ver os detalhes e a análise de IA.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Create dialog ----------------------- */

function CreateEditalDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (p: {
    titulo: string; orgao?: string | null; numero_edital?: string | null;
    modalidade?: string | null; objeto?: string | null;
    valor_estimado?: number | null; data_abertura?: string | null;
    url_origem?: string | null; origem: "manual" | "pncp" | "upload";
  }) => void;
}) {
  const [form, setForm] = useState({
    titulo: "", orgao: "", numero_edital: "", modalidade: "",
    objeto: "", valor_estimado: "", data_abertura: "", url_origem: "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Novo edital</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo edital</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Órgão</Label>
              <Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} />
            </div>
            <div>
              <Label>Nº do edital</Label>
              <Input value={form.numero_edital} onChange={(e) => setForm({ ...form, numero_edital: e.target.value })} />
            </div>
            <div>
              <Label>Modalidade</Label>
              <Input placeholder="Pregão Eletrônico, Concorrência..." value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })} />
            </div>
            <div>
              <Label>Data de abertura</Label>
              <Input type="datetime-local" value={form.data_abertura} onChange={(e) => setForm({ ...form, data_abertura: e.target.value })} />
            </div>
            <div>
              <Label>Valor estimado (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} />
            </div>
            <div>
              <Label>URL de origem</Label>
              <Input placeholder="https://..." value={form.url_origem} onChange={(e) => setForm({ ...form, url_origem: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Objeto</Label>
            <Textarea rows={4} value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.titulo.trim()) { toast.error("Informe o título."); return; }
              onSubmit({
                titulo: form.titulo.trim(),
                orgao: form.orgao.trim() || null,
                numero_edital: form.numero_edital.trim() || null,
                modalidade: form.modalidade.trim() || null,
                objeto: form.objeto.trim() || null,
                valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
                data_abertura: form.data_abertura ? new Date(form.data_abertura).toISOString() : null,
                url_origem: form.url_origem.trim() || null,
                origem: "manual",
              });
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------- Detail panel ----------------------- */

function EditalDetail({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const listFn = useServerFn(listEditais);
  const analyzeFn = useServerFn(analyzeEdital);
  const listChecklistFn = useServerFn(listChecklist);
  const updateItemFn = useServerFn(updateChecklistItem);
  const listDocsFn = useServerFn(listEditalDocumentos);
  const uploadDocFn = useServerFn(uploadEditalDocumento);
  const getUrlFn = useServerFn(getEditalDocumentoUrl);
  const extractFn = useServerFn(extractDocumentoTexto);
  const qc = useQueryClient();

  const { data: editais } = useQuery({
    queryKey: ["editais"],
    queryFn: () => listFn({ data: undefined as never }),
  });
  const edital = editais?.find((e) => e.id === id);

  const { data: checklist } = useQuery({
    queryKey: ["edital-checklist", id],
    queryFn: () => listChecklistFn({ data: { edital_id: id } }),
  });
  const { data: docs } = useQuery({
    queryKey: ["edital-docs", id],
    queryFn: () => listDocsFn({ data: { edital_id: id } }),
  });

  const analyzeMut = useMutation({
    mutationFn: async () => analyzeFn({ data: { edital_id: id } }),
    onSuccess: (r) => {
      toast.success(`IA gerou ${r.itens} item(ns) de checklist.`);
      qc.invalidateQueries({ queryKey: ["editais"] });
      qc.invalidateQueries({ queryKey: ["edital-checklist", id] });
    },
    onError: (e: Error) => toast.error(`Falha na IA: ${e.message}`),
  });

  const updateItemMut = useMutation({
    mutationFn: async (p: { id: string; status?: ChecklistRow["status"]; observacoes?: string | null }) =>
      updateItemFn({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edital-checklist", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      return uploadDocFn({
        data: {
          edital_id: id,
          nome_arquivo: file.name,
          mime_type: file.type || "application/octet-stream",
          base64,
          tipo: "edital",
        },
      });
    },
    onSuccess: () => {
      toast.success("PDF anexado.");
      qc.invalidateQueries({ queryKey: ["edital-docs", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extractMut = useMutation({
    mutationFn: async (documento_id: string) => extractFn({ data: { documento_id } }),
    onSuccess: (r) => {
      toast.success(`Texto extraído: ${r.paginas} página(s), ${r.caracteres} caracteres.`);
      qc.invalidateQueries({ queryKey: ["edital-docs", id] });
    },
    onError: (e: Error) => toast.error(`Extração falhou: ${e.message}`),
  });

  if (!edital) return null;

  // agrupar checklist por categoria
  const byCat = new Map<string, ChecklistRow[]>();
  (checklist ?? []).forEach((it) => {
    const arr = byCat.get(it.categoria) ?? [];
    arr.push(it);
    byCat.set(it.categoria, arr);
  });

  const totals = (checklist ?? []).reduce(
    (a, it) => {
      a[it.status] = (a[it.status] ?? 0) + 1;
      a.total += 1;
      return a;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <CardTitle className="text-lg">{edital.titulo}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {edital.orgao ?? "—"} · {edital.modalidade ?? "—"} · {brl(edital.valor_estimado)}
              </div>
              <div className="text-xs text-muted-foreground">
                Abertura: {fmtDate(edital.data_abertura)} · {edital.numero_edital ?? "s/nº"}
                {edital.url_origem && (
                  <a href={edital.url_origem} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary">
                    <ExternalLink className="w-3 h-3" /> origem
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => analyzeMut.mutate()}
                disabled={analyzeMut.isPending}
              >
                {analyzeMut.isPending ? (
                  <><Clock className="w-4 h-4 mr-1 animate-spin" /> Analisando…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Analisar com IA</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { if (confirm("Excluir este edital?")) onDeleted(); }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {edital.objeto && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Objeto</div>
              <div className="text-sm">{edital.objeto}</div>
            </div>
          )}
          {edital.resumo_ia && (
            <div className="bg-primary/5 border border-primary/20 rounded p-3">
              <div className="text-xs uppercase text-primary mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Resumo executivo (IA)
              </div>
              <div className="text-sm whitespace-pre-wrap">{edital.resumo_ia}</div>
              {edital.ia_modelo && (
                <div className="text-[10px] text-muted-foreground mt-2">
                  Modelo: {edital.ia_modelo} · {fmtDate(edital.ia_processado_em)}
                </div>
              )}
            </div>
          )}

          {/* Upload de PDF */}
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">Documentos anexados</div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded cursor-pointer hover:bg-muted/40">
              <Upload className="w-4 h-4" />
              {uploadMut.isPending ? "Enviando…" : "Anexar PDF do edital"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 25 * 1024 * 1024) { toast.error("Máx. 25MB."); return; }
                    uploadMut.mutate(f);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {(docs ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {(docs as Array<{ id: string; nome_arquivo: string; mime_type: string | null; paginas: number | null; texto_extraido?: string | null }>).map((d) => {
                  const extracted = (d.paginas ?? 0) > 0;
                  const isPdf = (d.mime_type ?? "").includes("pdf");
                  return (
                    <div key={d.id} className="flex items-center justify-between text-xs p-2 border rounded">
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{d.nome_arquivo}</span>
                        {extracted && (
                          <Badge variant="outline" className="text-[10px]">{d.paginas}p extraídas</Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPdf && (
                          <Button
                            size="sm" variant="ghost" className="h-6"
                            disabled={extractMut.isPending}
                            onClick={() => extractMut.mutate(d.id)}
                          >
                            {extractMut.isPending && extractMut.variables === d.id
                              ? "extraindo…"
                              : extracted ? "reextrair" : "extrair texto"}
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost" className="h-6"
                          onClick={async () => {
                            try {
                              const { url } = await getUrlFn({ data: { documento_id: d.id } });
                              window.open(url, "_blank");
                            } catch (e) { toast.error((e as Error).message); }
                          }}
                        >abrir</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Checklist de habilitação</CardTitle>
            <div className="flex gap-1 text-xs">
              <Badge variant="outline">{totals.total ?? 0} itens</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">{totals.ok ?? 0} ok</Badge>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">{totals.faltante ?? 0} faltantes</Badge>
              <Badge variant="secondary">{totals.pendente ?? 0} pendentes</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(checklist ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {edital.status === "processando"
                ? "IA processando…"
                : 'Sem itens. Clique em "Analisar com IA" para gerar o checklist.'}
            </div>
          ) : (
            Array.from(byCat.entries()).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                  {CATEGORIA_LABEL[cat] ?? cat} ({items.length})
                </div>
                <div className="space-y-1">
                  {items.map((it) => (
                    <ChecklistItemRow
                      key={it.id}
                      item={it}
                      onStatusChange={(status) =>
                        updateItemMut.mutate({ id: it.id, status: status as ChecklistRow["status"] })
                      }
                      onObsBlur={(observacoes) =>
                        updateItemMut.mutate({ id: it.id, observacoes })
                      }
                      onOpenPage={async (pagina) => {
                        const first = (docs as Array<{ id: string; paginas: number | null }> | undefined)?.find(
                          (d) => (d.paginas ?? 0) > 0,
                        );
                        if (!first) {
                          toast.error("Extraia o texto do PDF para navegar até a página.");
                          return;
                        }
                        try {
                          const { url } = await getUrlFn({ data: { documento_id: first.id } });
                          window.open(`${url}#page=${pagina}`, "_blank");
                        } catch (e) { toast.error((e as Error).message); }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistItemRow({
  item, onStatusChange, onObsBlur, onOpenPage,
}: {
  item: ChecklistRow;
  onStatusChange: (s: string) => void;
  onObsBlur: (obs: string | null) => void;
  onOpenPage?: (pagina: number) => void;
}) {
  const [obs, setObs] = useState(item.observacoes ?? "");

  const Icon = item.status === "ok" ? CheckCircle2
    : item.status === "faltante" ? XCircle
    : item.status === "nao_aplicavel" ? MinusCircle
    : Clock;

  const iconCls = item.status === "ok" ? "text-emerald-600"
    : item.status === "faltante" ? "text-destructive"
    : item.status === "nao_aplicavel" ? "text-muted-foreground"
    : "text-amber-600";

  return (
    <div className="border rounded p-2 space-y-2">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconCls}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            {item.requisito}
            {item.obrigatorio && (
              <Badge variant="outline" className="ml-2 text-[10px]">obrigatório</Badge>
            )}
          </div>
          {item.trecho_edital && (
            <div className="text-xs text-muted-foreground italic mt-1 border-l-2 border-muted-foreground/30 pl-2">
              "{item.trecho_edital}"
              {item.pagina_referencia != null && (
                onOpenPage ? (
                  <button
                    type="button"
                    onClick={() => onOpenPage(item.pagina_referencia as number)}
                    className="not-italic ml-1 text-primary hover:underline"
                  >
                    — p.{item.pagina_referencia}
                  </button>
                ) : (
                  <span className="not-italic"> — p.{item.pagina_referencia}</span>
                )
              )}
            </div>
          )}
        </div>
        <Select value={item.status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="faltante">Faltante</SelectItem>
            <SelectItem value="nao_aplicavel">N/A</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if ((item.observacoes ?? "") !== obs) onObsBlur(obs || null);
        }}
        placeholder="Observações…"
        className="text-xs min-h-[40px]"
        rows={1}
      />
    </div>
  );
}
