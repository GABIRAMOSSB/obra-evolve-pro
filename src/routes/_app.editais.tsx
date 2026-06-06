import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listEditais,
  createEdital,
  analyzeEdital,
  listChecklist,
  updateChecklistItem,
  deleteEdital,
  uploadEditalDocumento,
  type EditalRow,
  type ChecklistRow,
} from "@/lib/editais.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/editais")({
  component: EditaisPage,
  head: () => ({ meta: [{ title: "Editais (IA) — SOLV Gestão" }] }),
});

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}
function fmtCurrency(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_TONE: Record<string, string> = {
  novo: "bg-muted/40 text-foreground border-border",
  processando: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  analisado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  erro: "bg-red-500/15 text-red-400 border-red-500/30",
  arquivado: "bg-muted/30 text-muted-foreground border-border",
};

const CATEGORIA_LABEL: Record<string, string> = {
  habilitacao_juridica: "Habilitação Jurídica",
  regularidade_fiscal: "Regularidade Fiscal e Trabalhista",
  qualificacao_tecnica: "Qualificação Técnica",
  qualificacao_economica: "Qualificação Econômico-Financeira",
  documentos_proposta: "Documentos da Proposta",
  outros: "Outros",
};

const STATUS_CHECKLIST_TONE: Record<string, string> = {
  pendente: "bg-muted/30 text-muted-foreground border-border",
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  faltante: "bg-red-500/15 text-red-400 border-red-500/30",
  nao_aplicavel: "bg-muted/40 text-foreground border-border",
};

function EditaisPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <EditalDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <EditalList onOpen={setSelectedId} />;
}

/* =================== LIST =================== */

function EditalList({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useServerFn(listEditais);
  const remove = useServerFn(deleteEdital);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["editais"],
    queryFn: () => list(),
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Edital removido");
      qc.invalidateQueries({ queryKey: ["editais"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Editais (IA)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre editais e gere automaticamente um resumo executivo e checklist de habilitação via IA.
          </p>
        </div>
        <NewEditalDialog onCreated={() => qc.invalidateQueries({ queryKey: ["editais"] })} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Edital</th>
                <th className="px-4 py-3 font-medium">Órgão</th>
                <th className="px-4 py-3 font-medium">Modalidade</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Abertura</th>
                <th className="px-4 py-3 font-medium">Checklist</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum edital cadastrado. Clique em "Novo edital" para começar.
                  </td>
                </tr>
              )}
              {(data ?? []).map((ed: EditalRow) => (
                <tr key={ed.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <button
                      className="text-left font-medium hover:text-primary"
                      onClick={() => onOpen(ed.id)}
                    >
                      {ed.titulo}
                    </button>
                    {ed.numero_edital && (
                      <div className="text-xs text-muted-foreground">{ed.numero_edital}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ed.orgao ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ed.modalidade ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtCurrency(ed.valor_estimado)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtDate(ed.data_abertura)}</td>
                  <td className="px-4 py-3 tabular-nums">{ed.checklist_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_TONE[ed.status] ?? ""}>
                      {ed.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remover "${ed.titulo}"?`)) del.mutate(ed.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* =================== NEW DIALOG =================== */

function NewEditalDialog({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createEdital);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [orgao, setOrgao] = useState("");
  const [numero, setNumero] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [objeto, setObjeto] = useState("");
  const [valor, setValor] = useState("");
  const [dataAbertura, setDataAbertura] = useState("");
  const [url, setUrl] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          titulo,
          orgao: orgao || null,
          numero_edital: numero || null,
          modalidade: modalidade || null,
          objeto: objeto || null,
          valor_estimado: valor ? Number(valor) : null,
          data_abertura: dataAbertura || null,
          url_origem: url || null,
          origem: "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Edital criado");
      setOpen(false);
      setTitulo("");
      setOrgao("");
      setNumero("");
      setModalidade("");
      setObjeto("");
      setValor("");
      setDataAbertura("");
      setUrl("");
      onCreated();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo edital
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo edital</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Órgão</Label>
            <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} />
          </div>
          <div>
            <Label>Número do edital</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div>
            <Label>Modalidade</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Pregão eletrônico",
                  "Pregão presencial",
                  "Concorrência",
                  "Tomada de preços",
                  "Convite",
                  "Concurso",
                  "Leilão",
                  "Dispensa",
                  "Inexigibilidade",
                  "RDC",
                ].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor estimado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label>Data de abertura</Label>
            <Input
              type="date"
              value={dataAbertura}
              onChange={(e) => setDataAbertura(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>URL de origem</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <Label>Objeto</Label>
            <Textarea
              rows={3}
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              placeholder="Descrição do objeto da licitação"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!titulo || mut.isPending}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =================== DETAIL =================== */

function EditalDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const list = useServerFn(listEditais);
  const analyze = useServerFn(analyzeEdital);
  const upload = useServerFn(uploadEditalDocumento);
  const listCk = useServerFn(listChecklist);
  const updateCk = useServerFn(updateChecklistItem);

  const qc = useQueryClient();
  const { data: editais } = useQuery({ queryKey: ["editais"], queryFn: () => list() });
  const edital = editais?.find((e: EditalRow) => e.id === id);

  const { data: checklist } = useQuery({
    queryKey: ["edital-checklist", id],
    queryFn: () => listCk({ data: { edital_id: id } }),
  });

  const ana = useMutation({
    mutationFn: () => analyze({ data: { edital_id: id } }),
    onSuccess: (r) => {
      toast.success(`Análise concluída — ${r.itens} item(s) no checklist.`);
      qc.invalidateQueries({ queryKey: ["editais"] });
      qc.invalidateQueries({ queryKey: ["edital-checklist", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const up = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      return upload({
        data: {
          edital_id: id,
          nome_arquivo: file.name,
          mime_type: file.type || "application/pdf",
          tipo: "edital",
          base64: b64,
        },
      });
    },
    onSuccess: () => {
      toast.success("PDF anexado");
      qc.invalidateQueries({ queryKey: ["editais"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const upCk = useMutation({
    mutationFn: (vars: { id: string; status?: string; observacoes?: string | null }) =>
      updateCk({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edital-checklist", id] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!edital) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div className="text-muted-foreground mt-6">Carregando…</div>
      </div>
    );
  }

  const grouped = (checklist ?? []).reduce<Record<string, ChecklistRow[]>>((acc, it) => {
    (acc[it.categoria] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="w-4 h-4 mr-1" />
        Voltar
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold">{edital.titulo}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {edital.orgao && <span>{edital.orgao}</span>}
            {edital.modalidade && <span>· {edital.modalidade}</span>}
            {edital.numero_edital && <span>· nº {edital.numero_edital}</span>}
            <span>· Abertura {fmtDate(edital.data_abertura)}</span>
            <span>· {fmtCurrency(edital.valor_estimado)}</span>
            {edital.url_origem && (
              <a
                href={edital.url_origem}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Origem <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <Badge variant="outline" className={`mt-2 ${STATUS_TONE[edital.status] ?? ""}`}>
            {edital.status}
            {edital.ia_modelo ? ` · ${edital.ia_modelo}` : ""}
          </Badge>
        </div>
        <div className="flex gap-2">
          <label>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) up.mutate(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" asChild disabled={up.isPending}>
              <span className="cursor-pointer">
                {up.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Anexar PDF
              </span>
            </Button>
          </label>
          <Button onClick={() => ana.mutate()} disabled={ana.isPending}>
            {ana.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {edital.status === "analisado" ? "Reanalisar com IA" : "Analisar com IA"}
          </Button>
        </div>
      </div>

      {edital.resumo_ia && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Resumo executivo (IA)
          </div>
          <div className="text-sm whitespace-pre-wrap">{edital.resumo_ia}</div>
        </Card>
      )}

      {Object.keys(grouped).length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum item no checklist ainda. Clique em "Analisar com IA" para gerar.
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <Card key={cat} className="overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border font-medium">
              {CATEGORIA_LABEL[cat] ?? cat}
              <span className="text-muted-foreground ml-2 text-xs">({items.length})</span>
            </div>
            <div className="divide-y divide-border/40">
              {items.map((it) => (
                <div key={it.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      {it.requisito}
                      {it.obrigatorio && (
                        <Badge variant="outline" className="ml-2 text-[10px] py-0">
                          obrigatório
                        </Badge>
                      )}
                    </div>
                    {it.trecho_edital && (
                      <div className="text-xs text-muted-foreground mt-1 italic border-l-2 border-border pl-2">
                        "{it.trecho_edital}"
                        {it.pagina_referencia ? ` (p. ${it.pagina_referencia})` : ""}
                      </div>
                    )}
                    <Textarea
                      rows={1}
                      defaultValue={it.observacoes ?? ""}
                      placeholder="Observações…"
                      className="mt-2 text-xs"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (it.observacoes ?? ""))
                          upCk.mutate({ id: it.id, observacoes: v || null });
                      }}
                    />
                  </div>
                  <Select
                    value={it.status}
                    onValueChange={(v) => upCk.mutate({ id: it.id, status: v })}
                  >
                    <SelectTrigger
                      className={`w-[150px] ${STATUS_CHECKLIST_TONE[it.status] ?? ""}`}
                    >
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
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
