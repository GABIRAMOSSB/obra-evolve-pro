import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPropostas,
  createProposta,
  updateProposta,
  deleteProposta,
  listEditaisParaSelect,
  gerarRascunho,
  type PropostaRow,
  type PropostaStatus,
} from "@/lib/propostas.functions";
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
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  Sparkles,
  Save,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/propostas")({
  component: PropostasPage,
  head: () => ({ meta: [{ title: "Propostas (IA) — SOLV Gestão" }] }),
});

const STATUS_LABEL: Record<PropostaStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  enviada: "Enviada",
  perdida: "Perdida",
  ganha: "Ganha",
};
const STATUS_VARIANT: Record<PropostaStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  em_revisao: "secondary",
  aprovada: "secondary",
  enviada: "default",
  perdida: "destructive",
  ganha: "default",
};

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PropostasPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? (
    <PropostaDetail id={selected} onBack={() => setSelected(null)} />
  ) : (
    <PropostaList onOpen={setSelected} />
  );
}

function PropostaList({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useServerFn(listPropostas);
  const remove = useServerFn(deleteProposta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["propostas"],
    queryFn: () => list(),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Proposta removida");
      qc.invalidateQueries({ queryKey: ["propostas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const rows = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Propostas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rascunhos técnico-comerciais com auxílio de IA, vinculados a editais.
          </p>
        </div>
        <NovaPropostaDialog />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhuma proposta ainda. Crie uma a partir de um edital existente.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-left px-4 py-3">Edital</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => onOpen(p.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.titulo}</div>
                    {p.ai_meta_gerado_em && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        IA: {new Date(p.ai_meta_gerado_em).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[300px]">
                    {p.edital_titulo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtBRL(p.valor_proposto)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remover "${p.titulo}"?`)) del.mutate(p.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function NovaPropostaDialog() {
  const create = useServerFn(createProposta);
  const listEd = useServerFn(listEditaisParaSelect);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [editalId, setEditalId] = useState<string>("none");

  const { data: editais } = useQuery({
    queryKey: ["propostas-editais-select"],
    queryFn: () => listEd(),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          titulo: titulo.trim(),
          edital_id: editalId === "none" ? null : editalId,
        },
      }),
    onSuccess: () => {
      toast.success("Proposta criada");
      qc.invalidateQueries({ queryKey: ["propostas"] });
      setOpen(false);
      setTitulo("");
      setEditalId("none");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Nova proposta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Proposta — Pavimentação Av. X"
            />
          </div>
          <div>
            <Label>Edital vinculado</Label>
            <Select value={editalId} onValueChange={setEditalId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {((editais ?? []) as Array<{ id: string; titulo: string }>).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Vincular um edital permite gerar o rascunho com IA usando contexto e checklist.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!titulo.trim() || mut.isPending}>
            {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropostaDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const list = useServerFn(listPropostas);
  const update = useServerFn(updateProposta);
  const gerar = useServerFn(gerarRascunho);
  const qc = useQueryClient();

  const { data: propostas } = useQuery({
    queryKey: ["propostas"],
    queryFn: () => list(),
  });
  const proposta = useMemo(
    () => propostas?.find((p: PropostaRow) => p.id === id),
    [propostas, id]
  );

  const [form, setForm] = useState<Partial<PropostaRow>>({});
  const merged: PropostaRow | null = proposta
    ? ({ ...proposta, ...form } as PropostaRow)
    : null;

  const save = useMutation({
    mutationFn: () => {
      if (!merged) throw new Error("Proposta não carregada.");
      return update({
        data: {
          id,
          titulo: merged.titulo,
          status: merged.status,
          valor_proposto: merged.valor_proposto,
          prazo_execucao_dias: merged.prazo_execucao_dias,
          resumo_executivo: merged.resumo_executivo,
          metodologia: merged.metodologia,
          equipe_tecnica: merged.equipe_tecnica,
          cronograma: merged.cronograma,
          diferenciais: merged.diferenciais,
          observacoes: merged.observacoes,
        },
      });
    },
    onSuccess: () => {
      toast.success("Proposta salva");
      setForm({});
      qc.invalidateQueries({ queryKey: ["propostas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const [instrucoes, setInstrucoes] = useState("");
  const ai = useMutation({
    mutationFn: () =>
      gerar({ data: { proposta_id: id, instrucoes: instrucoes.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Rascunho gerado pela IA");
      qc.invalidateQueries({ queryKey: ["propostas"] });
      setForm({});
      setInstrucoes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!merged) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="text-muted-foreground mt-6">Carregando…</div>
      </div>
    );
  }

  const update_ = <K extends keyof PropostaRow>(key: K, value: PropostaRow[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const exportText = () => {
    const txt = [
      `# ${merged.titulo}`,
      merged.edital_titulo ? `Edital: ${merged.edital_titulo}` : "",
      merged.valor_proposto != null ? `Valor: ${fmtBRL(merged.valor_proposto)}` : "",
      merged.prazo_execucao_dias != null
        ? `Prazo: ${merged.prazo_execucao_dias} dias`
        : "",
      "",
      "## Resumo executivo",
      merged.resumo_executivo ?? "",
      "",
      "## Metodologia",
      merged.metodologia ?? "",
      "",
      "## Equipe técnica",
      merged.equipe_tecnica ?? "",
      "",
      "## Cronograma",
      merged.cronograma ?? "",
      "",
      "## Diferenciais",
      merged.diferenciais ?? "",
      "",
      merged.observacoes ? "## Observações\n" + merged.observacoes : "",
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard
      .writeText(txt)
      .then(() => toast.success("Proposta copiada para a área de transferência"))
      .catch(() => toast.error("Não foi possível copiar"));
  };

  const dirty = Object.keys(form).length > 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportText}>
            <Copy className="w-4 h-4 mr-2" /> Copiar texto
          </Button>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <FileText className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={merged.titulo}
            onChange={(e) => update_("titulo", e.target.value)}
            className="text-xl font-bold border-0 px-0 shadow-none focus-visible:ring-0"
          />
          <p className="text-sm text-muted-foreground">
            {merged.edital_titulo ? `Edital: ${merged.edital_titulo}` : "Sem edital vinculado"}
          </p>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Status</Label>
          <Select
            value={merged.status}
            onValueChange={(v) => update_("status", v as PropostaStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor proposto (R$)</Label>
          <Input
            type="number"
            value={merged.valor_proposto ?? ""}
            onChange={(e) =>
              update_("valor_proposto", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <div>
          <Label>Prazo execução (dias)</Label>
          <Input
            type="number"
            value={merged.prazo_execucao_dias ?? ""}
            onChange={(e) =>
              update_(
                "prazo_execucao_dias",
                e.target.value ? Number(e.target.value) : null
              )
            }
          />
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-1 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Gerar rascunho com IA</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Usa o edital vinculado, requisitos do checklist e sua biblioteca de documentos
              para produzir resumo executivo, metodologia, equipe, cronograma e diferenciais.
              {merged.ai_meta_gerado_em && (
                <>
                  {" "}Último: {new Date(merged.ai_meta_gerado_em).toLocaleString("pt-BR")}
                </>
              )}
            </p>
            <Textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              placeholder="Instruções opcionais (ex.: enfatizar experiência em pavimentação asfáltica em climas tropicais)"
              rows={2}
            />
            <Button
              className="mt-3"
              onClick={() => ai.mutate()}
              disabled={ai.isPending}
            >
              {ai.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {merged.ai_meta_gerado_em ? "Regerar com IA" : "Gerar rascunho"}
            </Button>
          </div>
        </div>
      </Card>

      <SecaoTextarea
        label="Resumo executivo"
        value={merged.resumo_executivo}
        onChange={(v) => update_("resumo_executivo", v)}
      />
      <SecaoTextarea
        label="Metodologia"
        value={merged.metodologia}
        onChange={(v) => update_("metodologia", v)}
        rows={8}
      />
      <SecaoTextarea
        label="Equipe técnica"
        value={merged.equipe_tecnica}
        onChange={(v) => update_("equipe_tecnica", v)}
        rows={6}
      />
      <SecaoTextarea
        label="Cronograma"
        value={merged.cronograma}
        onChange={(v) => update_("cronograma", v)}
        rows={6}
      />
      <SecaoTextarea
        label="Diferenciais"
        value={merged.diferenciais}
        onChange={(v) => update_("diferenciais", v)}
        rows={6}
      />
      <SecaoTextarea
        label="Observações internas"
        value={merged.observacoes}
        onChange={(v) => update_("observacoes", v)}
        rows={3}
      />
    </div>
  );
}

function SecaoTextarea({
  label,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Card className="p-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-2 resize-y"
        placeholder="—"
      />
    </Card>
  );
}
