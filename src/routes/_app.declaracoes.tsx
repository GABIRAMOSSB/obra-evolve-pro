import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Copy, Printer, FileSignature, Wand2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  listDeclaracoes, upsertDeclaracao, excluirDeclaracao, previewDeclaracao,
  TIPOS_DECLARACAO, type DeclaracaoRow, type TipoDeclaracao,
} from "@/lib/declaracoes.functions";
import { listPoderes } from "@/lib/poderes.functions";

export const Route = createFileRoute("/_app/declaracoes")({
  component: DeclaracoesPage,
});

type FormState = {
  id?: string;
  tipo: TipoDeclaracao;
  titulo: string;
  conteudo: string;
  signatario_id: string;
  oportunidade_id: string;
  edital_id: string;
  data_emissao: string;
  observacoes: string;
};

const initialForm = (): FormState => ({
  tipo: "habilitacao",
  titulo: "Declaração de Habilitação",
  conteudo: "",
  signatario_id: "",
  oportunidade_id: "",
  edital_id: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  observacoes: "",
});

function tipoBadge(t: TipoDeclaracao) {
  const meta = TIPOS_DECLARACAO.find((x) => x.value === t);
  return <Badge variant="outline">{meta?.value ?? t}</Badge>;
}

function DeclaracoesPage() {
  const listFn = useServerFn(listDeclaracoes);
  const upsertFn = useServerFn(upsertDeclaracao);
  const delFn = useServerFn(excluirDeclaracao);
  const previewFn = useServerFn(previewDeclaracao);
  const podFn = useServerFn(listPoderes);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["declaracoes"],
    queryFn: () => listFn(),
  });
  const { data: poderes } = useQuery({
    queryKey: ["poderes-min"],
    queryFn: () => podFn(),
  });

  const signatariosAtivos = useMemo(
    () => (poderes?.signatarios ?? []).filter((s) => s.ativo),
    [poderes],
  );

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<DeclaracaoRow | null>(null);
  const [form, setForm] = useState<FormState>(initialForm());

  const openNew = () => { setForm(initialForm()); setOpen(true); };
  const openEdit = (d: DeclaracaoRow) => {
    setForm({
      id: d.id,
      tipo: d.tipo,
      titulo: d.titulo,
      conteudo: d.conteudo,
      signatario_id: d.signatario_id ?? "",
      oportunidade_id: d.oportunidade_id ?? "",
      edital_id: d.edital_id ?? "",
      data_emissao: d.data_emissao,
      observacoes: d.observacoes ?? "",
    });
    setOpen(true);
  };

  const gerar = useMutation({
    mutationFn: () => previewFn({
      data: {
        tipo: form.tipo,
        signatario_id: form.signatario_id || null,
        oportunidade_id: form.oportunidade_id || null,
        edital_id: form.edital_id || null,
      },
    }),
    onSuccess: (r) => {
      setForm((f) => ({ ...f, titulo: r.titulo, conteudo: r.conteudo }));
      toast.success("Texto gerado a partir do modelo.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const salvar = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: form.id,
        tipo: form.tipo,
        titulo: form.titulo,
        conteudo: form.conteudo,
        signatario_id: form.signatario_id || null,
        oportunidade_id: form.oportunidade_id || null,
        edital_id: form.edital_id || null,
        data_emissao: form.data_emissao,
        observacoes: form.observacoes || null,
      },
    }),
    onSuccess: () => {
      toast.success("Declaração salva.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["declaracoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Declaração excluída.");
      qc.invalidateQueries({ queryKey: ["declaracoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onTipoChange = (v: TipoDeclaracao) => {
    const meta = TIPOS_DECLARACAO.find((t) => t.value === v);
    setForm((f) => ({ ...f, tipo: v, titulo: meta?.titulo ?? f.titulo }));
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const imprimir = (titulo: string, conteudo: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${titulo}</title>
      <style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.6;white-space:pre-wrap;}</style>
      </head><body>${conteudo.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  const declaracoes = data?.declaracoes ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="w-6 h-6" /> Declarações de Licitação
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos formais com base na Lei 14.133/21 — vinculadas a signatários e oportunidades.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nova declaração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Declarações emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : declaracoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma declaração registrada. Crie a primeira usando os modelos pré-definidos.
            </p>
          ) : (
            <div className="space-y-2">
              {declaracoes.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {tipoBadge(d.tipo)}
                      <span className="font-medium truncate">{d.titulo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      <span>Emissão: {new Date(d.data_emissao).toLocaleDateString("pt-BR")}</span>
                      {d.signatario && <span>Signatário: {d.signatario.nome}</span>}
                      {d.edital && <span>Edital: {d.edital.numero_edital ?? d.edital.titulo}</span>}
                      {d.oportunidade && <span>Oport.: {d.oportunidade.titulo}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setViewing(d); setViewOpen(true); }}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm("Excluir esta declaração?")) excluir.mutate(d.id); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar declaração" : "Nova declaração"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => onTipoChange(v as TipoDeclaracao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DECLARACAO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de emissão</Label>
                <Input
                  type="date" value={form.data_emissao}
                  onChange={(e) => setForm({ ...form, data_emissao: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>

            <div>
              <Label>Signatário</Label>
              <Select
                value={form.signatario_id || "__none"}
                onValueChange={(v) => setForm({ ...form, signatario_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— sem signatário —</SelectItem>
                  {signatariosAtivos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}{s.cargo ? ` — ${s.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Conteúdo</Label>
              <Button
                type="button" size="sm" variant="secondary"
                onClick={() => gerar.mutate()} disabled={gerar.isPending}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                {gerar.isPending ? "Gerando…" : "Gerar a partir do modelo"}
              </Button>
            </div>
            <Textarea
              rows={14}
              value={form.conteudo}
              onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              className="font-mono text-sm"
            />

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={2} value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização / impressão */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.titulo}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm font-serif leading-relaxed p-4 bg-muted rounded-md">
            {viewing?.conteudo}
          </pre>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => viewing && copiar(viewing.conteudo)}
            >
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </Button>
            <Button onClick={() => viewing && imprimir(viewing.titulo, viewing.conteudo)}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
